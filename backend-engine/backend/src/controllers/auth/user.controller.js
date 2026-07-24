import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/apiError.js";
import { ApiResponse } from "../../utils/apiResponse.js";
import { ERROR_CODES } from "../../utils/errorCodes.js";
import { uploadMedia } from "../../utils/mediaUpload.js"
import jwt from "jsonwebtoken"
import { mongoClient, pgClient } from "../../prisma.js"
import bcrypt from "bcrypt"
import userCache from "../../utils/cache.js";
import { logger } from "../../../logs/logger.js";
import {
    USER_EDITABLE_FIELDS,
    PLAYER_PROFILE_EDITABLE_FIELDS,
    PUBLIC_PLAYER_SELECT,
    PUBLIC_PLAYER_PROFILE_SELECT,
    coerceProfileField,
    computeProfileCompletion,
    completionBoost,
} from "../../utils/profileService.js";


const generateAccessToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            user_type: user.user_type
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

const generateRefreshToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

const isPasswordCorrect = async (password, hashedPassword) => {
    return await bcrypt.compare(password, hashedPassword);
}


const generateAccessAndRefreshTokens = async (userId) => {

    try {
        const user = await pgClient.users.findUnique({
            where: {
                id: userId
            },
            select: {
                id: true,
                email: true,
                user_type: true
            }
        })

        if (!user) {
            throw ApiError.fromCode(ERROR_CODES.USER_NOT_FOUND);
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);


        const refreshTokenUpdateResponse = await pgClient.users.update({
            where: {
                id: userId
            },
            data: {
                refresh_token: refreshToken
            }
        })

        if (!refreshTokenUpdateResponse) {
            throw ApiError.fromCode(ERROR_CODES.TOKEN_GENERATION_FAILED);
        }

        return { accessToken, refreshToken }

    } catch (error) {
        // Preserve a meaningful ApiError; only wrap truly unexpected failures.
        if (error instanceof ApiError) throw error;
        throw ApiError.fromCode(ERROR_CODES.TOKEN_GENERATION_FAILED);
    }
}

const registerUser = asyncHandler(async (req, res) => {
    const {
        email,
        phone,
        password_hash,
        first_name,
        last_name,
        date_of_birth,
        gender,
        profile_picture_url,
        bio,
        division,
        district,
        latitude,
        longitude,
        status,
        email_verified,
        phone_verified,
        preferred_language,
        timezone
    } = req.body;


    if (!first_name || !last_name || !email || !password_hash) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "first_name, last_name, email and password are required",
        });
    }

    // Self-service account type, but whitelisted: a signup may only choose
    // "player" or "turf_admin". "super_admin" is NEVER assignable via public
    // register (must be granted out-of-band). Anything else falls back to player.
    const ALLOWED_SIGNUP_ROLES = ["player", "turf_admin"];
    const user_type = ALLOWED_SIGNUP_ROLES.includes(req.body.user_type)
        ? req.body.user_type
        : "player";

    // email and phone are each individually unique, so findUnique can't take both
    // as one locator — use findFirst with OR to detect a clash on either field.
    const existingUser = await pgClient.users.findFirst({
        where: {
            OR: [
                { email },
                ...(phone ? [{ phone }] : []),
            ],
        },
    });

    if (existingUser) {
        throw ApiError.fromCode(ERROR_CODES.USER_ALREADY_EXISTS);
    }

    // const profilePictureLocalPath = req.files?.profilePicture[0].path;

    // const profilePictureUrl = await uploadMedia(profilePictureLocalPath);

    // if (!profilePictureUrl) {
    //     throw new ApiError(400, "Profile picture upload failed");
    // }

    const user = await pgClient.users.create({
        data: {
            email,
            phone,
            password_hash,
            first_name,
            last_name,
            date_of_birth,
            gender,
            profile_picture_url,
            bio,
            // Home location (optional) — powers turfmate recommendations.
            division,
            district,
            latitude,
            longitude,
            user_type,
            status,
            email_verified,
            phone_verified,
            preferred_language,
            timezone
        }
    })

    if (!user) {
        throw new ApiError(500, "Failed to create user");
    }

    // NEVER select password_hash here: this row is spread straight into the
    // response below, so selecting it would hand the caller back the bcrypt hash
    // of their own password. Login deliberately selects it (it has to compare
    // against it) and strips it before responding — this path has no such need.
    const newlyCreatedUser = await pgClient.users.findUnique({
        where: {
            id: user.id
        },
        select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            status: true,
            user_type: true,
            bio: true,
            email_verified: true,
            phone_verified: true,
            profile_picture_url: true
        }
    })

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(newlyCreatedUser.id);

    const serverResponse = {
        ...newlyCreatedUser,
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRY
    }

    return res
        .status(201)
        .json(new ApiResponse(201, "User created successfully", serverResponse));

})

const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // console.log("REQUEST: ",req);

    if (!email || !password) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "email and password are required",
        });
    }

    const user = await pgClient.users.findUnique({
        where: {
            email: email
        },
        select: {
            id: true,
            email: true,
            password_hash: true,
            first_name: true,
            last_name: true,
            status: true,
            user_type: true,
            bio: true,
            email_verified: true,
            phone_verified: true,
            profile_picture_url: true
        }
    })

    // Use the same generic error for "no such user" and "wrong password" so the
    // API doesn't leak which emails are registered (user-enumeration guard).
    if (!user) {
        throw ApiError.fromCode(ERROR_CODES.INVALID_CREDENTIALS);
    }

    const { password_hash, ...response } = user

    const isPasswordValid = await isPasswordCorrect(password, user.password_hash);

    if (!isPasswordValid) {
        throw ApiError.fromCode(ERROR_CODES.INVALID_CREDENTIALS);
    }

    // Derived, not stored. Everything else the client needs about the account is
    // already on `response`.
    //
    // This response deliberately carries NO activity aggregates. It used to ship
    // `sports: []`, `teamsJoined/eventsJoined/friends: 0` — all hardcoded, none
    // backed by a query, so they were simply wrong for every user who had ever
    // played. A caller that wants those must read GET /users/:user_id, which
    // counts them live.
    const username = user.email.split("@")[0];

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.id)

    // const options = {
    //     httpOnly: true,
    //     secure: true
    // }

    const userResponse = {
        ...response,
        username,
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRY
    }

    return res
        .status(200)
        // .cookie("accessToken", accessToken, options)
        // .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                "User Logged In Successfully.",
                {
                    user: userResponse
                }
            )
        )
})

const logoutUser = asyncHandler(async (req, res) => {

    await pgClient.users.update({
        where: {
            id: req.user.id
        },
        data: {
            refreshToken: null
        }
    })


    // const options = {
    //     httpOnly: true,
    //     secure: true
    // }

    return res
        .status(200)
        // .clearCookie("accessToken", options)
        // .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(
                200,
                {},
                "User Logged Out Successfully."
            )
        )
})

const tokenRefresh = asyncHandler(async (req, res) => {
    const browserRefreshToken = req.body.refresh_token;

    if (!browserRefreshToken) {
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(
            browserRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )

        const user = await pgClient.users.findUnique({
            where: {
                id: decodedToken.id
            },
            select: {
                id: true,
                refresh_token: true
            }
        })

        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }

        if (browserRefreshToken !== user.refresh_token) {
            throw new ApiError(401, "Refresh token is expired or invalid")
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user.id)
        // const options = {
        //     httpOnly: true,
        //     secure: true
        // }

        return res
            .status(200)
            // .cookie("accessToken", newAccessToken, options)
            // .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    "Token Refreshed Successfully.",
                    {
                        accessToken: accessToken,
                        refreshToken: refreshToken,
                        tokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRY
                    }
                )
            )
    } catch (error) {
        throw new ApiError(401, "Token refresh failed")
    }

})

const getUserById = asyncHandler(async (req, res) => {
    const { user_id } = req.params;

    // Public profile = the user's account fields + their sporting profile
    // (player_profiles, 1:1 in practice) so the page can show EVERY data point:
    // skill, positions, physique, play preferences, reputation, etc.
    const user = await pgClient.users.findUnique({
        where: { id: user_id },
        select: {
            id: true,
            email: true,
            phone: true,
            first_name: true,
            last_name: true,
            date_of_birth: true,
            gender: true,
            profile_picture_url: true,
            cover_photo_url: true,
            bio: true,
            division: true,
            district: true,
            latitude: true,
            longitude: true,
            user_type: true,
            status: true,
            email_verified: true,
            phone_verified: true,
            preferred_language: true,
            timezone: true,
            last_login_at: true,
            created_at: true,
            updated_at: true,
            player_profiles: {
                select: {
                    preferred_positions: true,
                    skill_level: true,
                    years_of_experience: true,
                    preferred_foot: true,
                    jersey_number: true,
                    height_cm: true,
                    weight_kg: true,
                    achievements: true,
                    sports_played: true,
                    availability_schedule: true,
                    preferred_play_time: true,
                    max_travel_distance_km: true,
                    rating: true,
                    total_games_played: true,
                    total_games_organized: true,
                    reliability_score: true,
                },
                take: 1,
            },
        },
    });

    // Must return here — falling through on a missing user would crash on
    // `user.email` below and mask the real 404 as a 500.
    if (!user) {
        throw ApiError.fromCode(ERROR_CODES.USER_NOT_FOUND);
    }

    // Live aggregates (cheap COUNTs, run in parallel) — replaces the old
    // hardcoded zeros. friends = accepted connections in EITHER direction.
    const [approvedJoins, gamesOrganized, friends] = await Promise.all([
        pgClient.event_participants.count({
            where: { user_id, status: "approved" },
        }),
        pgClient.events.count({ where: { organizer_id: user_id } }),
        pgClient.connections.count({
            where: {
                status: "accepted",
                OR: [{ requester_id: user_id }, { recipient_id: user_id }],
            },
        }),
    ]);

    const profile = user.player_profiles?.[0] ?? null;
    // Sports come from the player profile's JSON list when present.
    const sports = Array.isArray(profile?.sports_played) ? profile.sports_played : [];

    const { player_profiles, ...account } = user;
    const userResponse = {
        ...account,
        player_profile: profile,   // full sporting profile (null if none yet)
        sports,
        eventsJoined: approvedJoins,
        gamesOrganized,
        friends,
        // Player reputation rating lives on the sporting profile; surface it flat too.
        rating: profile?.rating != null ? Number(profile.rating) : null,
        username: user.email.split("@")[0],
        // How complete this profile is, scored server-side so the client never
        // has to duplicate the checklist. Returned for every profile (not just
        // your own) because it's derived from already-public fields; the UI only
        // renders the nudge card on your own page.
        profile_completion: computeProfileCompletion(user, profile),
    };

    return res
        .status(200)
        .json(new ApiResponse(200, "User found", userResponse));
})


/**
 * GET /users/scout — find players to recruit.
 *
 * The search a captain actually runs: "who near me plays football, as a winger,
 * at roughly this level?". Filters are all optional and AND together; the caller
 * is always excluded from their own results.
 *
 * Query params:
 *   q         name fragment (case-insensitive, matches first OR last name)
 *   sport     exact value from the sports list, matched inside `sports_played`
 *   position  exact value, matched inside `preferred_positions`
 *   skill     skill_level_type
 *   division  exact division
 *   district  exact district
 *   limit     1..50 (default 20)
 *
 * RANKING — profile completeness is the dominant term. Every result already
 * satisfies the filters, so relevance is binary and what's left is "who can this
 * captain actually evaluate and reach". A profile with no sport, position or
 * skill is unrankable noise however close by they live. Form (rating,
 * reliability) and proximity break the remaining ties. See `completionBoost`.
 *
 * PRIVACY — results use PUBLIC_PLAYER_SELECT, which carries no email or phone:
 * an authenticated people-search that returned contact details would be a
 * harvesting endpoint. Auth is required for the same reason — this must not be
 * an anonymous directory of every user.
 */
const scoutPlayers = asyncHandler(async (req, res) => {
    const myId = req.user.id;
    const { q, sport, position, skill, division, district } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 50);

    // --- account-level filters -------------------------------------------
    const where = {
        status: "active",
        id: { not: myId }, // you can't scout yourself
    };

    if (division) where.division = String(division);
    if (district) where.district = String(district);

    const term = typeof q === "string" ? q.trim() : "";
    if (term) {
        where.OR = [
            { first_name: { contains: term, mode: "insensitive" } },
            { last_name: { contains: term, mode: "insensitive" } },
        ];
    }

    // --- sporting filters (live on player_profiles) ----------------------
    // `sports_played` / `preferred_positions` are JSON arrays, so they're matched
    // with `array_contains` rather than an equality test.
    const profileWhere = {};
    if (skill) profileWhere.skill_level = String(skill);
    if (sport) profileWhere.sports_played = { array_contains: [String(sport)] };
    if (position) profileWhere.preferred_positions = { array_contains: [String(position)] };

    if (Object.keys(profileWhere).length > 0) {
        // `some` because player_profiles is modelled to-many (a user has at most
        // one row in practice). This also implicitly drops players with no
        // sporting profile at all — correct, since they can't match a sport filter.
        where.player_profiles = { some: profileWhere };
    }

    // Pull a bounded candidate pool, then rank in memory. The pool is capped so a
    // broad search (no filters at all) can't turn into a full table scan + sort.
    const POOL = 200;
    const [me, candidates] = await Promise.all([
        pgClient.users.findUnique({
            where: { id: myId },
            select: { division: true, district: true },
        }),
        pgClient.users.findMany({
            where,
            select: {
                ...PUBLIC_PLAYER_SELECT,
                // Needed by the completeness scorer even though they aren't all
                // rendered — the score must match what the player sees on their
                // own profile page.
                date_of_birth: true,
                gender: true,
                phone: true,
                player_profiles: { select: PUBLIC_PLAYER_PROFILE_SELECT, take: 1 },
            },
            orderBy: { created_at: "desc" },
            take: POOL,
        }),
    ]);

    const players = candidates
        .map((row) => {
            const { player_profiles, phone, ...user } = row;
            const profile = player_profiles?.[0] ?? null;

            const completion = computeProfileCompletion(
                // `phone` is scored but never returned — see PRIVACY above.
                { ...user, phone },
                profile
            );

            // Completeness dominates; form and proximity break ties.
            const boost = completionBoost({ ...user, phone }, profile);
            const areaScore =
                me?.district && user.district === me.district
                    ? 3
                    : me?.division && user.division === me.division
                      ? 1
                      : 0;
            const ratingScore = profile?.rating != null ? Number(profile.rating) : 0;
            const reliabilityScore =
                profile?.reliability_score != null ? (profile.reliability_score / 100) * 2 : 0;

            return {
                ...user,
                profile,
                profile_completion_percent: completion.percent,
                _score: boost + areaScore + ratingScore + reliabilityScore,
            };
        })
        .sort((a, b) => b._score - a._score)
        .slice(0, limit)
        .map(({ _score, ...rest }) => rest); // internal score never leaves the server

    logger.info(
        `scout: user=${myId} filters=[${[
            term && "q", sport && "sport", position && "position",
            skill && "skill", division && "division", district && "district",
        ].filter(Boolean).join(",")}] -> ${players.length}`
    );

    return res.status(200).json(
        new ApiResponse(200, "Players found", { players, count: players.length })
    );
});


/**
 * PATCH /users/me — edit your OWN profile.
 *
 * Partial update spanning two tables: the account row (`users`) and the sporting
 * profile (`player_profiles`, upserted so a player who never had one gets it on
 * first save). Both writes run in a single transaction, so a profile can never
 * end up half-saved.
 *
 * SECURITY — the target is always `req.user.id`, taken from the verified JWT.
 * There is deliberately no user id in the path or body: with one, a caller could
 * edit somebody else's profile simply by changing a uuid. Fields are ALLOWLISTED
 * in profileService.js (identity, verification flags and server-derived
 * reputation are not editable) and every value is validated/coerced there,
 * including a host check on the image URLs.
 */
const updateMyProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    // Split the body across the two tables, ignoring anything not allowlisted.
    // `hasOwnProperty` (not a truthiness check) so an explicit null — "clear this
    // field" — is honoured rather than silently dropped.
    const userData = {};
    const profileData = {};

    for (const field of USER_EDITABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
            userData[field] = coerceProfileField(field, req.body[field]);
        }
    }
    for (const field of PLAYER_PROFILE_EDITABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
            profileData[field] = coerceProfileField(field, req.body[field]);
        }
    }

    const touchesUser = Object.keys(userData).length > 0;
    const touchesProfile = Object.keys(profileData).length > 0;

    if (!touchesUser && !touchesProfile) {
        throw ApiError.fromCode(ERROR_CODES.VALIDATION_ERROR, {
            message: "No editable fields were provided",
        });
    }

    const ops = [];

    if (touchesUser) {
        userData.updated_at = new Date();
        ops.push(pgClient.users.update({ where: { id: userId }, data: userData }));
    }

    if (touchesProfile) {
        // Create-or-update by hand rather than `upsert`: upsert needs a UNIQUE
        // column to match on, and `player_profiles.user_id` is only indexed (the
        // relation is modelled to-many even though a user has at most one row).
        // Most players have no row until their first edit, so an update-only
        // write would fail the very first time.
        const existing = await pgClient.player_profiles.findFirst({
            where: { user_id: userId },
            select: { id: true },
        });

        ops.push(
            existing
                ? pgClient.player_profiles.update({
                      where: { id: existing.id },
                      data: { ...profileData, updated_at: new Date() },
                  })
                : pgClient.player_profiles.create({
                      data: { user_id: userId, ...profileData },
                  })
        );
    }

    try {
        await pgClient.$transaction(ops);
    } catch (err) {
        // P2002 = unique constraint. The only user-settable unique column here is
        // `phone`, so translate it into a clear 409 instead of a raw 500.
        if (err?.code === "P2002") {
            throw ApiError.fromCode(ERROR_CODES.CONFLICT, {
                message: "That phone number is already used by another account",
            });
        }
        throw err;
    }

    // Cached auth lookups key on the user — drop the stale copy so the next
    // request sees the edit (see utils/cache.js).
    userCache.del(userId);

    // Re-read through the same shape the profile page consumes, so the client can
    // drop the response straight into its cache (fresh completion score included).
    const [user, profileRow] = await Promise.all([
        pgClient.users.findUnique({
            where: { id: userId },
            select: {
                id: true, email: true, phone: true, first_name: true, last_name: true,
                date_of_birth: true, gender: true, profile_picture_url: true,
                cover_photo_url: true, bio: true, division: true, district: true,
                user_type: true, email_verified: true, phone_verified: true,
                created_at: true, updated_at: true,
            },
        }),
        pgClient.player_profiles.findFirst({ where: { user_id: userId } }),
    ]);

    logger.info(
        `profile updated: user=${userId} ` +
        `fields=[${[...Object.keys(userData), ...Object.keys(profileData)].join(",")}]`
    );

    return res.status(200).json(
        new ApiResponse(200, "Profile updated", {
            ...user,
            player_profile: profileRow,
            sports: Array.isArray(profileRow?.sports_played) ? profileRow.sports_played : [],
            profile_completion: computeProfileCompletion(user, profileRow),
        })
    );
});


// Using node-cache | (Use redis in future)
const varifyLogin = asyncHandler(async (req, res) => {
    console.log("Varifying Login...");

    const accessToken = req.cookies.accessToken || req.body.accessToken
    if (!accessToken) {
        return res.status(401).json(new ApiResponse(401, "Unauthorized request"))
    }

    try {
        const decodedToken = jwt.verify(
            accessToken,
            process.env.ACCESS_TOKEN_SECRET
        )
        const userId = decodedToken.id

        // Check Cache first
        let cachedUser = userCache.get(userId)

        if (!cachedUser) {
            console.log("Cache miss");

            const user = await mongoClient.user.findUnique({
                where: {
                    id: decodedToken.id
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    address: true,
                    bio: true,
                    sportsPreferences: true,
                    eventsJoined: true,
                    role: true,
                    rating: true,
                    profilePicture: true
                }
            })

            if (!user) {
                return res.status(401).json(new ApiError(401, "Invalid access token"))
            }
            // cache the result
            userCache.set(userId, user)
            cachedUser = user
        }

        console.log("Cache hit");

        return res.
            status(200)
            .json(new ApiResponse(200, "User logged in successfully", { user: cachedUser }))


    } catch (error) {
        throw new ApiError(401, "Access token is expired or invalid")
    }
})

export {
    registerUser,
    loginUser,
    logoutUser,
    tokenRefresh,
    varifyLogin,
    getUserById,
    updateMyProfile,
    scoutPlayers
}