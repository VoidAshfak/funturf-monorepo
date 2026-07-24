import { decodeId, isPublicId, maskDeep, unmaskDeep } from "../utils/publicId.js";

/**
 * Public-id translation layer.
 *
 * Sits between the wire and the rest of the API so that no controller, service
 * or serializer has to think about masking at all:
 *
 *   inbound   opaque token  ->  internal UUID   (path, query, body)
 *   outbound  internal UUID ->  opaque token    (every JSON response)
 *
 * WHY A GLOBAL LAYER AND NOT PER-SERIALIZER
 * Only 2 of the 12 controllers route their responses through `dataSerializer`;
 * the other 10 return Prisma rows directly. Masking inside the serializers would
 * therefore have covered a small minority of responses and left the rest leaking
 * internal keys, with no way to tell which was which by reading a route. Doing it
 * once at the boundary is the only version that fails closed — a new endpoint is
 * masked the moment it is written, including one added by someone who has never
 * read this file.
 *
 * ORDERING (matters, mount exactly as in app.js):
 *   express.json  ->  this  ->  routes  ->  errorHandler
 * The body must already be parsed for `unmaskDeep` to see it, and the path must
 * be rewritten before the router matches, which is why the rewrite targets
 * `req.url` rather than `req.params` — at app level `req.params` is still empty,
 * as it is only populated once a route pattern matches.
 */

/**
 * Rewrite any path segment that is one of our tokens back into a UUID.
 *
 * Runs over the raw path instead of route params so that all ~40 routes are
 * covered without being touched individually. A segment is only rewritten if it
 * both looks like a token (22 base64url chars) and decrypts to a valid v4 UUID,
 * so ordinary segments like `available-slots` or `create-venue` can never be
 * caught by accident.
 */
function rewritePath(url) {
    const [path, query] = url.split("?");

    // Fast path: no segment is even token-shaped, so skip the crypto entirely.
    if (!path.split("/").some(isPublicId)) return url;

    const rewritten = path
        .split("/")
        .map((segment) => (isPublicId(segment) ? decodeId(segment) ?? segment : segment))
        .join("/");

    return query === undefined ? rewritten : `${rewritten}?${query}`;
}

/**
 * Inbound: translate tokens to UUIDs on the way in.
 *
 * `validateUuidParams` and every Prisma call downstream then see exactly what
 * they saw before this feature existed, which is why no route file needed to
 * change.
 */
export function unmaskRequestIds(req, _res, next) {
    if (req.url) req.url = rewritePath(req.url);

    // Express 4 exposes `req.query` as a plain writable property (this would need
    // `Object.defineProperty` on Express 5, where it became a getter).
    if (req.query && typeof req.query === "object") {
        req.query = unmaskDeep(req.query);
    }

    if (req.body && typeof req.body === "object") {
        req.body = unmaskDeep(req.body);
    }

    return next();
}

/**
 * Outbound: mask every UUID in the response body.
 *
 * Wraps `res.json` rather than using an `on('finish')` hook because the payload
 * has to be rewritten before serialization, not observed after it. Error
 * responses go through `res.json` too, so `errorHandler` output is covered
 * without a second code path.
 *
 * Note this also masks the id inside the login/refresh payload, which is what
 * keeps the frontend consistent: NextAuth seeds `session.user.id` from that
 * response, so ownership comparisons like `session.user.id === venue.admin_user_id`
 * are masked on both sides and keep working untouched.
 */
export function maskResponseIds(_req, res, next) {
    const originalJson = res.json.bind(res);

    res.json = (payload) => originalJson(maskDeep(payload));

    return next();
}

/** Both directions, in the order they must run. Mount once in app.js. */
export const publicIdTranslation = [unmaskRequestIds, maskResponseIds];
