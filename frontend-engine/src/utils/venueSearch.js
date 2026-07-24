import { getLocationString } from "./utility-functions";

// Shared venue-search helpers, used by both the homepage hero quick-search
// (HeroSearch) and the full turfs page (VenuesExplorer) so the two stay in
// lockstep — a match in the hero dropdown is guaranteed to match on /venues.

// A ground's sport_type is a MULTISELECT — an array like ["Football","Cricket"],
// and sports_available can be nested the same way. Flatten one level, coerce to
// strings, and dedupe so callers always get a flat list of unique sport names.
export function venueSports(venue) {
    const raw =
        Array.isArray(venue?.sports_available) && venue.sports_available.length
            ? venue.sports_available
            : (venue?.grounds || []).map((g) => g.sport_type);

    return [...new Set(raw.flat().filter(Boolean).map(String))];
}

// Human-readable location string, guarded against a missing/odd address shape.
export function locationText(venue) {
    try {
        return getLocationString(venue?.address_line_1 || {});
    } catch {
        return "";
    }
}

// Does a venue match a free-text query? Matches across name, location and sports.
// An empty query matches everything (same semantics as the explorer filter).
export function venueMatchesQuery(venue, query) {
    const needle = (query || "").trim().toLowerCase();
    if (!needle) return true;
    const haystack = [venue?.name, locationText(venue), ...venueSports(venue)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    return haystack.includes(needle);
}

// Filter a venue list by query, optionally capping the result count (the hero
// dropdown passes limit=2 for its preview; the explorer passes no limit).
export function searchVenues(venues = [], query = "", limit) {
    const list = venues.filter((v) => venueMatchesQuery(v, query));
    return typeof limit === "number" ? list.slice(0, limit) : list;
}
