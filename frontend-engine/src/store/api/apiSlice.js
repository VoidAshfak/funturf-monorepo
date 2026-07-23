import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { getSession, signOut } from "next-auth/react";
import { getSocket } from "@/lib/socket";
import { toastIncomingNotification } from "@/lib/notify";
import { clearCredentials, setCredentials } from "@/store/slices/authSlice";

// Backend base from env (NEXT_PUBLIC_ so it's exposed client-side); see getData.js / NextAuth route.
const BASE_URL = `${process.env.NEXT_PUBLIC_API_BASE_URL}/`;

const rawBaseQuery = fetchBaseQuery({
    baseUrl: BASE_URL,
    prepareHeaders: (headers, { getState }) => {
        // token is synced from the NextAuth session into authSlice (see AuthSync)
        const token = getState().auth?.token;
        if (token) headers.set("authorization", `Bearer ${token}`);
        return headers;
    },
});

// De-dupes concurrent refreshes: many in-flight requests can 401 at once, but we
// only want ONE call to NextAuth's session endpoint (which runs the jwt callback
// and rotates the backend token) — the rest await the same promise.
let refreshPromise = null;

/**
 * baseQuery wrapper that recovers from an expired access token.
 *
 * On a 401 we ask NextAuth for a fresh session (`getSession()` re-runs the server
 * `jwt` callback, which silently refreshes the backend token), push the new token
 * into Redux so `prepareHeaders` picks it up, and retry the request ONCE. If the
 * session can't be refreshed (or the retry still 401s) the session is dead, so we
 * sign the user out. This is the mid-session net; the jwt callback handles the
 * common "expired between page loads" case proactively.
 */
const baseQueryWithReauth = async (args, api, extraOptions) => {
    let result = await rawBaseQuery(args, api, extraOptions);

    if (result.error?.status === 401) {
        // Only attempt recovery if we actually had a token — a 401 with no token
        // is just an unauthenticated call, not an expiry to refresh.
        const hadToken = Boolean(api.getState().auth?.token);
        if (!hadToken) return result;

        // Single shared refresh across all concurrent 401s.
        if (!refreshPromise) refreshPromise = getSession();
        let session;
        try {
            session = await refreshPromise;
        } finally {
            refreshPromise = null;
        }

        const newToken = session?.user?.access_token;
        if (session && !session.error && newToken) {
            // Update Redux first so the retry's prepareHeaders sends the new token.
            api.dispatch(setCredentials({ user: session.user, token: newToken }));
            result = await rawBaseQuery(args, api, extraOptions);
        }

        // Refresh failed, or the retry still 401s -> the session is unusable.
        if (session?.error || result.error?.status === 401) {
            api.dispatch(clearCredentials());
            await signOut({ callbackUrl: "/login" });
        }
    }

    return result;
};

export const apiSlice = createApi({
    reducerPath: "api",
    baseQuery: baseQueryWithReauth,
    tagTypes: ["Venues", "Venue", "Events", "Event", "JoinRequests", "Messages", "Comments", "Bookings", "Booking", "User", "Turfmates", "TurfmateRequests", "TurfmateRecs", "ConnectionStatus", "Notifications", "Conversations", "DmThread", "Promotions", "Teams", "Team", "TeamInvites", "Sports"],
    endpoints: (builder) => ({
        // ---- Venues ----
        getVenues: builder.query({
            query: () => "venues",
            transformResponse: (res) => res?.data ?? [],
            providesTags: (result) =>
                result
                    ? [
                          ...result.map((v) => ({ type: "Venue", id: v.id })),
                          { type: "Venues", id: "LIST" },
                      ]
                    : [{ type: "Venues", id: "LIST" }],
        }),
        getVenuesByAdmin: builder.query({
            query: (adminId) => `venues/get-venues-by-admin/${adminId}`,
            transformResponse: (res) => res?.data ?? [],
            providesTags: [{ type: "Venues", id: "LIST" }],
        }),
        getVenueById: builder.query({
            query: (venueId) => `venues/${venueId}`,
            transformResponse: (res) => res?.data ?? {},
            providesTags: (result, error, id) => [{ type: "Venue", id }],
        }),
        createVenue: builder.mutation({
            query: (body) => ({
                url: "venues/create-venue",
                method: "POST",
                body,
            }),
            invalidatesTags: [{ type: "Venues", id: "LIST" }],
        }),
        // ---- Promotions / coupons (turf manager) ----
        // All promotion endpoints are turf-manager scoped server-side.
        getPromotions: builder.query({
            query: () => "promotions",
            transformResponse: (res) => res?.data?.promotions ?? [],
            providesTags: [{ type: "Promotions", id: "LIST" }],
        }),
        getPromotionAnalytics: builder.query({
            query: (days) => `promotions/analytics${days ? `?days=${days}` : ""}`,
            transformResponse: (res) => res?.data ?? null,
            providesTags: [{ type: "Promotions", id: "ANALYTICS" }],
        }),
        createPromotion: builder.mutation({
            query: (body) => ({ url: "promotions", method: "POST", body }),
            invalidatesTags: [
                { type: "Promotions", id: "LIST" },
                { type: "Promotions", id: "ANALYTICS" },
            ],
        }),
        updatePromotion: builder.mutation({
            query: ({ id, ...body }) => ({ url: `promotions/${id}`, method: "PATCH", body }),
            invalidatesTags: [
                { type: "Promotions", id: "LIST" },
                { type: "Promotions", id: "ANALYTICS" },
            ],
        }),
        deletePromotion: builder.mutation({
            query: (id) => ({ url: `promotions/${id}`, method: "DELETE" }),
            invalidatesTags: [
                { type: "Promotions", id: "LIST" },
                { type: "Promotions", id: "ANALYTICS" },
            ],
        }),

        // Rate a turf (1–5). One rating per user; re-posting updates it. Refreshes
        // the venue so the average + the caller's own star fill update live.
        rateTurf: builder.mutation({
            query: ({ venueId, rating, comment }) => ({
                url: `venues/${venueId}/rating`,
                method: "POST",
                body: { rating, ...(comment ? { comment } : {}) },
            }),
            invalidatesTags: (r, e, { venueId }) => [
                { type: "Venue", id: venueId },
                { type: "Venues", id: "LIST" },
            ],
        }),
        // Add a ground to the caller's turf (turf-scoped server-side).
        createGround: builder.mutation({
            query: (body) => ({
                url: "venues/create-ground",
                method: "POST",
                body,
            }),
            invalidatesTags: [{ type: "Venues", id: "LIST" }],
        }),
        // Edit a ground's info (turf-scoped server-side).
        updateGround: builder.mutation({
            query: ({ groundId, ...body }) => ({
                url: `venues/grounds/${groundId}`,
                method: "PATCH",
                body,
            }),
            invalidatesTags: (r, e, { venueId }) => [
                { type: "Venues", id: "LIST" },
                ...(venueId ? [{ type: "Venue", id: venueId }] : []),
            ],
        }),

        // ---- Events ----
        // Paginated infinite-scroll feed. Args: { page, limit, sport, timeframe, q, openOnly }.
        // Pages accumulate into one cache entry per filter set: `serializeQueryArgs`
        // drops `page` from the cache key, `merge` appends each new page, and
        // `forceRefetch` re-runs the query whenever `page` changes.
        getEvents: builder.query({
            query: ({ page = 1, limit = 12, sport, timeframe, q, openOnly, joinedOnly } = {}) => ({
                url: "events",
                params: { page, limit, sport, timeframe, q, openOnly, joinedOnly },
            }),
            transformResponse: (res) => res?.data ?? { events: [], pagination: { page: 1, hasMore: false, total: 0 } },
            serializeQueryArgs: ({ queryArgs, endpointName }) => {
                // Cache key = endpoint + filters (NOT page), so pages of the same
                // filter set share one growing cache entry.
                const { page, ...filters } = queryArgs ?? {};
                return `${endpointName}(${JSON.stringify(filters)})`;
            },
            merge: (currentCache, incoming, { arg }) => {
                // Page 1 (fresh load / filter change) replaces; later pages append.
                if (!arg || arg.page === 1 || arg.page === undefined) {
                    currentCache.events = incoming.events;
                } else {
                    const seen = new Set(currentCache.events.map((e) => e.id));
                    currentCache.events.push(...incoming.events.filter((e) => !seen.has(e.id)));
                }
                currentCache.pagination = incoming.pagination;
                // stats only comes back on page 1 — keep the last known copy otherwise.
                if (incoming.stats) currentCache.stats = incoming.stats;
            },
            forceRefetch: ({ currentArg, previousArg }) =>
                currentArg?.page !== previousArg?.page,
            providesTags: (result) =>
                result?.events
                    ? [
                          ...result.events.map((e) => ({ type: "Event", id: e.id })),
                          { type: "Events", id: "LIST" },
                      ]
                    : [{ type: "Events", id: "LIST" }],
        }),
        getEventById: builder.query({
            query: (eventId) => `events/${eventId}`,
            transformResponse: (res) => res?.data ?? {},
            providesTags: (result, error, id) => [{ type: "Event", id }],
        }),
        createEvent: builder.mutation({
            query: (body) => ({
                url: "events/create-event",
                method: "POST",
                body,
            }),
            // Attaching a booking mutates that booking (sets its event_id), so the
            // "my bookings" list must refresh too, not just the events feed.
            invalidatesTags: [
                { type: "Events", id: "LIST" },
                { type: "Bookings", id: "MINE" },
            ],
        }),
        // Events the logged-in user participates in (GET /events/my-events, auth required).
        getMyEvents: builder.query({
            query: (params) => ({
                url: "events/my-events",
                params, // optional { status }
            }),
            transformResponse: (res) => res?.data?.events ?? [],
            providesTags: [{ type: "Events", id: "MINE" }],
        }),
        // Organizer-only edit (PATCH /events/update-event/:id).
        updateEvent: builder.mutation({
            query: ({ eventId, ...body }) => ({
                url: `events/update-event/${eventId}`,
                method: "PATCH",
                body,
            }),
            invalidatesTags: (result, error, { eventId }) => [
                { type: "Event", id: eventId },
                { type: "Events", id: "LIST" },
                { type: "Events", id: "MINE" },
            ],
        }),
        // Rematch: clone a match into a new one and re-invite the squad
        // (POST /events/:id/rematch). Refreshes the feed + "my events".
        rematchEvent: builder.mutation({
            query: ({ eventId, ...body }) => ({
                url: `events/${eventId}/rematch`,
                method: "POST",
                body, // { event_date, start_time, end_time }
            }),
            invalidatesTags: [
                { type: "Events", id: "LIST" },
                { type: "Events", id: "MINE" },
            ],
        }),
        // Organizer-only delete (DELETE /events/delete-event, event_id in body).
        // Organizer "delete" = soft cancel (status -> cancelled). Refreshes the open
        // match page plus the feeds it drops out of.
        deleteEvent: builder.mutation({
            query: (eventId) => ({
                url: "events/delete-event",
                method: "DELETE",
                body: { event_id: eventId },
            }),
            invalidatesTags: (r, e, eventId) => [
                { type: "Event", id: eventId },
                { type: "Events", id: "LIST" },
                { type: "Events", id: "MINE" },
            ],
        }),

        // ---- Bookings ----
        // Availability for a ground on a date (GET /bookings/available-slots?ground=&date=).
        getAvailableSlots: builder.query({
            query: ({ ground, date }) => ({
                url: "bookings/available-slots",
                params: { ground, date },
            }),
            transformResponse: (res) => res?.data ?? null,
            // The grid shows the caller's own bookings (`my_slots`) and other
            // people's unpaid holds, so any booking write makes it stale.
            providesTags: [{ type: "Bookings", id: "SLOTS" }],
        }),
        // Price quote for a single slot (GET /bookings/quote?ground_id=&slot=&booking_date=&promo_code=).
        getBookingQuote: builder.query({
            query: ({ ground_id, slot, booking_date, promo_code }) => ({
                url: "bookings/quote",
                params: { ground_id, slot, booking_date, promo_code },
            }),
            transformResponse: (res) => res?.data ?? null,
        }),
        // Coupons the signed-in caller can apply to a booking on this ground/date
        // (private/group coupons are filtered per user server-side).
        getAvailableCoupons: builder.query({
            query: ({ ground_id, date }) => ({
                url: "coupons/available",
                params: { ground_id, date },
            }),
            transformResponse: (res) => res?.data?.coupons ?? [],
        }),

        // ---- Notifications (all auth-required) ----
        // The list is the single source of truth: an initial REST fetch seeds it,
        // then a Socket.IO stream keeps it live via `onCacheEntryAdded`.
        getNotifications: builder.query({
            query: () => "notifications",
            transformResponse: (res) =>
                res?.data ?? { notifications: [], unreadCount: 0, pagination: {} },
            providesTags: [{ type: "Notifications", id: "LIST" }],
            async onCacheEntryAdded(
                _arg,
                { getState, updateCachedData, cacheDataLoaded, cacheEntryRemoved }
            ) {
                // Token is synced from the NextAuth session into authSlice (see AuthSync).
                const token = getState().auth?.token;
                const socket = token ? getSocket(token) : null;
                try {
                    await cacheDataLoaded; // wait for the initial fetch to populate
                    if (!socket) return;

                    // Live push: prepend the new notification + bump unread count.
                    const onNew = (notification) => {
                        let isNew = false;
                        updateCachedData((draft) => {
                            if (draft.notifications.some((n) => n.id === notification.id)) return;
                            isNew = true;
                            draft.notifications.unshift(notification);
                            draft.unreadCount = (draft.unreadCount || 0) + 1;
                            if (draft.pagination) {
                                draft.pagination.total = (draft.pagination.total || 0) + 1;
                            }
                        });

                        // Everything lands in the bell (above). Only HIGH-priority
                        // items also interrupt with a toast — see lib/notify.js for
                        // the policy. Guarded by `isNew` so a duplicate socket
                        // delivery can't toast twice.
                        if (isNew) {
                            toastIncomingNotification(notification, {
                                onAction: (url) => {
                                    if (typeof window !== "undefined") window.location.href = url;
                                },
                            });
                        }
                    };
                    socket.on("notification:new", onNew);

                    await cacheEntryRemoved; // clean up when the last subscriber unmounts
                    socket.off("notification:new", onNew);
                } catch {
                    // cacheDataLoaded rejects if the entry is removed before load — ignore.
                }
            },
        }),
        markNotificationRead: builder.mutation({
            query: (id) => ({ url: `notifications/${id}/read`, method: "PATCH" }),
            // Optimistic: flip is_read + decrement unread immediately.
            async onQueryStarted(id, { dispatch, queryFulfilled }) {
                const patch = dispatch(
                    apiSlice.util.updateQueryData("getNotifications", undefined, (draft) => {
                        const n = draft.notifications.find((x) => x.id === id);
                        if (n && !n.is_read) {
                            n.is_read = true;
                            n.read_at = new Date().toISOString();
                            draft.unreadCount = Math.max(0, (draft.unreadCount || 1) - 1);
                        }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patch.undo();
                }
            },
        }),
        markAllNotificationsRead: builder.mutation({
            query: () => ({ url: "notifications/read-all", method: "PATCH" }),
            async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
                const patch = dispatch(
                    apiSlice.util.updateQueryData("getNotifications", undefined, (draft) => {
                        draft.notifications.forEach((n) => {
                            n.is_read = true;
                        });
                        draft.unreadCount = 0;
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patch.undo();
                }
            },
        }),
        deleteNotification: builder.mutation({
            query: (id) => ({ url: `notifications/${id}`, method: "DELETE" }),
            async onQueryStarted(id, { dispatch, queryFulfilled }) {
                const patch = dispatch(
                    apiSlice.util.updateQueryData("getNotifications", undefined, (draft) => {
                        const idx = draft.notifications.findIndex((x) => x.id === id);
                        if (idx !== -1) {
                            if (!draft.notifications[idx].is_read) {
                                draft.unreadCount = Math.max(0, (draft.unreadCount || 1) - 1);
                            }
                            draft.notifications.splice(idx, 1);
                        }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patch.undo();
                }
            },
        }),

        // ---- Users ----
        getUserById: builder.query({
            query: (userId) => `users/${userId}`,
            transformResponse: (res) => res?.data ?? {},
            providesTags: (result, error, id) => [{ type: "User", id }],
        }),
        registerUser: builder.mutation({
            query: (body) => ({
                url: "users/register",
                method: "POST",
                body,
            }),
        }),

        // ---- Turfmates (all auth-required) ----
        // Accepted turfmates as profiles: { turfmates:[...], pagination }.
        getTurfmates: builder.query({
            query: (params) => ({ url: "turfmates/get-turfmates", params }),
            transformResponse: (res) => res?.data ?? { turfmates: [], pagination: {} },
            providesTags: [{ type: "Turfmates", id: "LIST" }],
        }),
        // Incoming pending requests: { requests:[{connectionId,user,...}], pagination }.
        getTurfmateRequests: builder.query({
            query: (params) => ({ url: "turfmates/get-pending-requests", params }),
            transformResponse: (res) => res?.data ?? { requests: [], pagination: {} },
            providesTags: [{ type: "TurfmateRequests", id: "LIST" }],
        }),
        // Outgoing pending requests I've sent.
        getOutgoingRequests: builder.query({
            query: (params) => ({ url: "turfmates/get-outgoing-requests", params }),
            transformResponse: (res) => res?.data ?? { requests: [], pagination: {} },
            providesTags: [{ type: "TurfmateRequests", id: "OUTGOING" }],
        }),
        // Location-based recommendations, with mutual-turfmate highlighting.
        getTurfmateRecommendations: builder.query({
            query: (params) => ({ url: "turfmates/recommendations", params }),
            transformResponse: (res) => res?.data?.recommendations ?? [],
            providesTags: [{ type: "TurfmateRecs", id: "LIST" }],
        }),
        // Relationship state between me and another user (for the profile button).
        getConnectionStatus: builder.query({
            query: (userId) => `turfmates/connection-status/${userId}`,
            transformResponse: (res) => res?.data ?? { status: "none" },
            // The LIST tag lets accept/cancel/remove (which don't know the other
            // party's user id) invalidate every open status query.
            providesTags: (result, error, userId) => [
                { type: "ConnectionStatus", id: userId },
                { type: "ConnectionStatus", id: "LIST" },
            ],
        }),
        // Mutual turfmates between me and another user (GET ?userTwo=) -> profiles.
        getMutualTurfmates: builder.query({
            query: (userTwo) => ({ url: "turfmates/get-mutual-turfmates", params: { userTwo } }),
            transformResponse: (res) => res?.data ?? [],
        }),
        sendTurfmateRequest: builder.mutation({
            query: (receiverId) => ({
                url: "turfmates/turfmate-request",
                method: "POST",
                body: { receiverId },
            }),
            invalidatesTags: (r, e, receiverId) => [
                { type: "TurfmateRequests", id: "OUTGOING" },
                { type: "TurfmateRecs", id: "LIST" },
                { type: "ConnectionStatus", id: receiverId },
            ],
        }),
        acceptTurfmateRequest: builder.mutation({
            query: (requestId) => ({
                url: "turfmates/accept-turfmate-request",
                method: "POST",
                body: { requestId },
            }),
            invalidatesTags: [
                { type: "TurfmateRequests", id: "LIST" },
                { type: "Turfmates", id: "LIST" },
                { type: "ConnectionStatus", id: "LIST" },
            ],
        }),
        rejectTurfmateRequest: builder.mutation({
            query: (requestId) => ({
                url: "turfmates/reject-turfmate-request",
                method: "POST",
                body: { requestId },
            }),
            invalidatesTags: [{ type: "TurfmateRequests", id: "LIST" }],
        }),
        cancelTurfmateRequest: builder.mutation({
            query: (requestId) => ({
                url: "turfmates/cancel-turfmate-request",
                method: "POST",
                body: { requestId },
            }),
            invalidatesTags: [
                { type: "TurfmateRequests", id: "OUTGOING" },
                { type: "TurfmateRecs", id: "LIST" },
                { type: "ConnectionStatus", id: "LIST" },
            ],
        }),
        removeTurfmate: builder.mutation({
            query: (userId) => ({
                url: "turfmates/remove-turfmate",
                method: "POST",
                body: { userId },
            }),
            invalidatesTags: (r, e, userId) => [
                { type: "Turfmates", id: "LIST" },
                { type: "ConnectionStatus", id: userId },
                { type: "ConnectionStatus", id: "LIST" },
            ],
        }),

        // ---- Teams (all auth-required) ----
        // A team is a PERSISTENT squad. Every write below is authorized
        // server-side by role (captain / co-captain / member) — the captain-only
        // UI gating in the components is cosmetic, never the boundary.
        //
        // Sports + their positions. Reference data behind the `sport_id` /
        // `position_id` foreign keys; cached on the server, so a plain query.
        getSportsCatalogue: builder.query({
            query: () => "teams/sports",
            transformResponse: (res) => res?.data?.sports ?? [],
            providesTags: [{ type: "Sports", id: "LIST" }],
        }),
        // Teams the caller is on: { teams:[{...team, member_count, my_role}], pagination }.
        getMyTeams: builder.query({
            query: (params) => ({ url: "teams/my-teams", params }),
            transformResponse: (res) => res?.data ?? { teams: [], pagination: {} },
            providesTags: (result) =>
                result?.teams
                    ? [
                          ...result.teams.map((t) => ({ type: "Team", id: t.id })),
                          { type: "Teams", id: "LIST" },
                      ]
                    : [{ type: "Teams", id: "LIST" }],
        }),
        // Team detail incl. the active roster and the caller's own `my_role`.
        getTeamById: builder.query({
            query: (teamId) => `teams/${teamId}`,
            transformResponse: (res) => res?.data ?? {},
            providesTags: (result, error, teamId) => [{ type: "Team", id: teamId }],
        }),
        createTeam: builder.mutation({
            query: (body) => ({ url: "teams", method: "POST", body }),
            invalidatesTags: [{ type: "Teams", id: "LIST" }],
        }),
        updateTeam: builder.mutation({
            query: ({ teamId, ...body }) => ({ url: `teams/${teamId}`, method: "PATCH", body }),
            invalidatesTags: (r, e, { teamId }) => [
                { type: "Team", id: teamId },
                { type: "Teams", id: "LIST" },
            ],
        }),
        // Disband — a SOFT delete server-side; the team drops out of every list.
        deleteTeam: builder.mutation({
            query: (teamId) => ({ url: `teams/${teamId}`, method: "DELETE" }),
            invalidatesTags: (r, e, teamId) => [
                { type: "Team", id: teamId },
                { type: "Teams", id: "LIST" },
            ],
        }),
        // Matches organized under a team.
        getTeamEvents: builder.query({
            query: ({ teamId, ...params }) => ({ url: `teams/${teamId}/events`, params }),
            transformResponse: (res) => res?.data ?? { events: [], pagination: {} },
            providesTags: (r, e, { teamId }) => [{ type: "Events", id: `TEAM-${teamId}` }],
        }),

        // ---- Team invites ----
        // The caller's own incoming invites, across every team.
        getMyTeamInvites: builder.query({
            query: (params) => ({ url: "teams/my-invites", params }),
            transformResponse: (res) => res?.data ?? { invites: [], pagination: {} },
            providesTags: [{ type: "TeamInvites", id: "MINE" }],
        }),
        // Invites a team has out — captain/co-captain only server-side.
        getTeamInvites: builder.query({
            query: ({ teamId, ...params }) => ({ url: `teams/${teamId}/invites`, params }),
            transformResponse: (res) => res?.data ?? { invites: [], pagination: {} },
            providesTags: (r, e, { teamId }) => [{ type: "TeamInvites", id: teamId }],
        }),
        sendTeamInvite: builder.mutation({
            query: ({ teamId, invitedUserId, message }) => ({
                url: `teams/${teamId}/invites`,
                method: "POST",
                body: { invitedUserId, message },
            }),
            invalidatesTags: (r, e, { teamId }) => [{ type: "TeamInvites", id: teamId }],
        }),
        // Accepting changes the roster, so the team itself goes stale too.
        acceptTeamInvite: builder.mutation({
            query: (inviteId) => ({ url: `teams/invites/${inviteId}/accept`, method: "POST" }),
            invalidatesTags: [
                { type: "TeamInvites", id: "MINE" },
                { type: "Teams", id: "LIST" },
            ],
        }),
        declineTeamInvite: builder.mutation({
            query: (inviteId) => ({ url: `teams/invites/${inviteId}/decline`, method: "POST" }),
            invalidatesTags: [{ type: "TeamInvites", id: "MINE" }],
        }),
        cancelTeamInvite: builder.mutation({
            query: ({ inviteId, teamId }) => ({
                url: `teams/invites/${inviteId}/cancel`,
                method: "POST",
            }),
            invalidatesTags: (r, e, { teamId }) => [
                { type: "TeamInvites", id: teamId },
                { type: "TeamInvites", id: "MINE" },
            ],
        }),

        // ---- Team roster management ----
        // Role / position change (captain only server-side).
        updateTeamMember: builder.mutation({
            query: ({ teamId, userId, ...body }) => ({
                url: `teams/${teamId}/members/${userId}`,
                method: "PATCH",
                body, // { role?, position_id? }
            }),
            invalidatesTags: (r, e, { teamId }) => [{ type: "Team", id: teamId }],
        }),
        // Captain removes someone, or a member leaves — same route, both cases
        // authorized server-side. The list refreshes too, since leaving drops the
        // team out of "my teams".
        removeTeamMember: builder.mutation({
            query: ({ teamId, userId }) => ({
                url: `teams/${teamId}/members/${userId}`,
                method: "DELETE",
            }),
            invalidatesTags: (r, e, { teamId }) => [
                { type: "Team", id: teamId },
                { type: "Teams", id: "LIST" },
            ],
        }),
        transferCaptaincy: builder.mutation({
            query: ({ teamId, newCaptainId }) => ({
                url: `teams/${teamId}/transfer-captaincy`,
                method: "POST",
                body: { newCaptainId },
            }),
            invalidatesTags: (r, e, { teamId }) => [
                { type: "Team", id: teamId },
                { type: "Teams", id: "LIST" },
            ],
        }),

        // ---- Event participation ----
        // Request to join a match (POST /:id/join). Creates a PENDING request an
        // event admin must approve — it does not join instantly.
        joinEvent: builder.mutation({
            query: (eventId) => ({ url: `events/${eventId}/join`, method: "POST" }),
            invalidatesTags: (r, e, eventId) => [
                { type: "Event", id: eventId },
                { type: "Events", id: "LIST" },
                { type: "Events", id: "MINE" },
                { type: "JoinRequests", id: eventId },
            ],
        }),
        // Withdraw your own pending join request (DELETE /:id/join).
        cancelJoinRequest: builder.mutation({
            query: (eventId) => ({ url: `events/${eventId}/join`, method: "DELETE" }),
            invalidatesTags: (r, e, eventId) => [
                { type: "Event", id: eventId },
                { type: "Events", id: "MINE" },
                { type: "JoinRequests", id: eventId },
            ],
        }),
        // Leave a match you were approved for (DELETE /:id/leave).
        leaveEvent: builder.mutation({
            query: (eventId) => ({ url: `events/${eventId}/leave`, method: "DELETE" }),
            invalidatesTags: (r, e, eventId) => [
                { type: "Event", id: eventId },
                { type: "Events", id: "LIST" },
                { type: "Events", id: "MINE" },
            ],
        }),

        // Accept an invitation (e.g. a rematch carry-over) — POST /:id/invitation/accept.
        // The invitee decides; accepting turns them into an approved player.
        acceptEventInvitation: builder.mutation({
            query: (eventId) => ({ url: `events/${eventId}/invitation/accept`, method: "POST" }),
            invalidatesTags: (r, e, eventId) => [
                { type: "Event", id: eventId },
                { type: "Events", id: "LIST" },
                { type: "Events", id: "MINE" },
            ],
        }),
        // Decline an invitation — POST /:id/invitation/decline. Removes the invite
        // row so the user can later request a spot the normal way.
        declineEventInvitation: builder.mutation({
            query: (eventId) => ({ url: `events/${eventId}/invitation/decline`, method: "POST" }),
            invalidatesTags: (r, e, eventId) => [
                { type: "Event", id: eventId },
                { type: "Events", id: "MINE" },
            ],
        }),

        // ---- Event admin moderation (admins only) ----
        // Pending join requests for an event (GET /:id/requests).
        getJoinRequests: builder.query({
            query: (eventId) => `events/${eventId}/requests`,
            transformResponse: (res) => res?.data?.requests ?? [],
            providesTags: (r, e, eventId) => [{ type: "JoinRequests", id: eventId }],
        }),
        // Approve a request (POST /:id/requests/:userId/accept).
        acceptJoinRequest: builder.mutation({
            query: ({ eventId, userId }) => ({
                url: `events/${eventId}/requests/${userId}/accept`,
                method: "POST",
            }),
            invalidatesTags: (r, e, { eventId }) => [
                { type: "JoinRequests", id: eventId },
                { type: "Event", id: eventId },
                { type: "Events", id: "LIST" },
            ],
        }),
        // Decline a request (POST /:id/requests/:userId/reject).
        rejectJoinRequest: builder.mutation({
            query: ({ eventId, userId }) => ({
                url: `events/${eventId}/requests/${userId}/reject`,
                method: "POST",
            }),
            invalidatesTags: (r, e, { eventId }) => [{ type: "JoinRequests", id: eventId }],
        }),
        // Grant event-admin to an approved participant (POST /:id/admins) — organizer only.
        grantEventAdmin: builder.mutation({
            query: ({ eventId, userId }) => ({
                url: `events/${eventId}/admins`,
                method: "POST",
                body: { user_id: userId },
            }),
            invalidatesTags: (r, e, { eventId }) => [{ type: "Event", id: eventId }],
        }),
        // Revoke event-admin (DELETE /:id/admins/:userId) — organizer only.
        revokeEventAdmin: builder.mutation({
            query: ({ eventId, userId }) => ({
                url: `events/${eventId}/admins/${userId}`,
                method: "DELETE",
            }),
            invalidatesTags: (r, e, { eventId }) => [{ type: "Event", id: eventId }],
        }),

        // ---- Squad group chat ----
        // History (last 50). Kept LIVE: after the initial fetch we listen on the
        // socket for `chat:new` and append matching messages, so the thread updates
        // in real time without polling. Member-only server-side.
        getEventMessages: builder.query({
            query: (eventId) => `events/${eventId}/messages`,
            transformResponse: (res) => res?.data?.messages ?? [],
            providesTags: (r, e, eventId) => [{ type: "Messages", id: eventId }],
            async onCacheEntryAdded(
                eventId,
                { getState, updateCachedData, cacheDataLoaded, cacheEntryRemoved }
            ) {
                const token = getState().auth?.token;
                const socket = token ? getSocket(token) : null;
                try {
                    await cacheDataLoaded;
                    if (!socket) return;

                    const forThis = (p) => p?.event_id === eventId;

                    // New message -> append (de-duped).
                    const onNew = (msg) => {
                        if (!forThis(msg)) return;
                        updateCachedData((draft) => {
                            if (draft.some((m) => m.id === msg.id)) return;
                            draft.push(msg);
                        });
                    };
                    // Edited message -> replace in place.
                    const onUpdate = (msg) => {
                        if (!forThis(msg)) return;
                        updateCachedData((draft) => {
                            const i = draft.findIndex((m) => m.id === msg.id);
                            if (i !== -1) draft[i] = msg;
                        });
                    };
                    // Soft-deleted -> flip to a tombstone (keep position/reply refs).
                    const onDelete = ({ id, event_id }) => {
                        if (event_id !== eventId) return;
                        updateCachedData((draft) => {
                            const m = draft.find((x) => x.id === id);
                            if (m) {
                                m.is_deleted = true;
                                m.content = null;
                                m.attachment_url = null;
                                m.reactions = [];
                                m.reply_to = null;
                            }
                        });
                    };
                    // Reaction change -> swap the message's grouped reactions.
                    const onReaction = ({ message_id, event_id, reactions }) => {
                        if (event_id !== eventId) return;
                        updateCachedData((draft) => {
                            const m = draft.find((x) => x.id === message_id);
                            if (m) m.reactions = reactions;
                        });
                    };

                    socket.on("chat:new", onNew);
                    socket.on("chat:update", onUpdate);
                    socket.on("chat:delete", onDelete);
                    socket.on("chat:reaction", onReaction);
                    await cacheEntryRemoved;
                    socket.off("chat:new", onNew);
                    socket.off("chat:update", onUpdate);
                    socket.off("chat:delete", onDelete);
                    socket.off("chat:reaction", onReaction);
                } catch {
                    // entry removed before load — ignore
                }
            },
        }),
        // Send a message (text and/or image attachment, optional reply). The socket
        // echoes it back too, but we also append the POST result so it shows
        // instantly even if the socket round-trip is slow (de-duped by id).
        sendEventMessage: builder.mutation({
            query: ({ eventId, content, attachment_url, reply_to_id, message_type }) => ({
                url: `events/${eventId}/messages`,
                method: "POST",
                body: { content, attachment_url, reply_to_id, message_type },
            }),
            async onQueryStarted({ eventId }, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled;
                    const msg = data?.data;
                    if (!msg) return;
                    dispatch(
                        apiSlice.util.updateQueryData("getEventMessages", eventId, (draft) => {
                            if (!draft.some((m) => m.id === msg.id)) draft.push(msg);
                        })
                    );
                } catch {
                    // error surfaced at the call site
                }
            },
        }),
        // Edit your own message's text.
        editEventMessage: builder.mutation({
            query: ({ eventId, messageId, content }) => ({
                url: `events/${eventId}/messages/${messageId}`,
                method: "PATCH",
                body: { content },
            }),
            async onQueryStarted({ eventId }, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled;
                    const msg = data?.data;
                    if (!msg) return;
                    dispatch(
                        apiSlice.util.updateQueryData("getEventMessages", eventId, (draft) => {
                            const i = draft.findIndex((m) => m.id === msg.id);
                            if (i !== -1) draft[i] = msg;
                        })
                    );
                } catch {
                    // surfaced at call site
                }
            },
        }),
        // Soft-delete a message (sender or match admin).
        deleteEventMessage: builder.mutation({
            query: ({ eventId, messageId }) => ({
                url: `events/${eventId}/messages/${messageId}`,
                method: "DELETE",
            }),
            async onQueryStarted({ eventId, messageId }, { dispatch, queryFulfilled }) {
                // Optimistic tombstone.
                const patch = dispatch(
                    apiSlice.util.updateQueryData("getEventMessages", eventId, (draft) => {
                        const m = draft.find((x) => x.id === messageId);
                        if (m) {
                            m.is_deleted = true;
                            m.content = null;
                            m.attachment_url = null;
                            m.reactions = [];
                            m.reply_to = null;
                        }
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patch.undo();
                }
            },
        }),
        // Toggle an emoji reaction on a message.
        reactEventMessage: builder.mutation({
            query: ({ eventId, messageId, emoji }) => ({
                url: `events/${eventId}/messages/${messageId}/reactions`,
                method: "POST",
                body: { emoji },
            }),
            async onQueryStarted({ eventId, messageId }, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled;
                    const reactions = data?.data?.reactions;
                    if (!reactions) return;
                    dispatch(
                        apiSlice.util.updateQueryData("getEventMessages", eventId, (draft) => {
                            const m = draft.find((x) => x.id === messageId);
                            if (m) m.reactions = reactions;
                        })
                    );
                } catch {
                    // surfaced at call site
                }
            },
        }),

        // Mark a match's squad chat read (clears its unread badge in the chat box).
        markEventChatRead: builder.mutation({
            query: (eventId) => ({ url: `events/${eventId}/messages/read`, method: "POST" }),
            invalidatesTags: [{ type: "Conversations", id: "LIST" }],
        }),

        // ---- Direct messages + unified conversation list ----
        // Unified conversation list (DMs + match chats) for the navbar chat box.
        // Kept live: any dm:new / dm:read / chat:new refreshes the previews + badges.
        getConversations: builder.query({
            query: () => "chat/conversations",
            transformResponse: (res) => res?.data ?? { conversations: [], total_unread: 0 },
            providesTags: [{ type: "Conversations", id: "LIST" }],
            async onCacheEntryAdded(_arg, { getState, dispatch, cacheDataLoaded, cacheEntryRemoved }) {
                const token = getState().auth?.token;
                const socket = token ? getSocket(token) : null;
                try {
                    await cacheDataLoaded;
                    if (!socket) return;
                    const refresh = () =>
                        dispatch(apiSlice.util.invalidateTags([{ type: "Conversations", id: "LIST" }]));
                    socket.on("dm:new", refresh);
                    socket.on("dm:read", refresh);
                    socket.on("chat:new", refresh);
                    await cacheEntryRemoved;
                    socket.off("dm:new", refresh);
                    socket.off("dm:read", refresh);
                    socket.off("chat:new", refresh);
                } catch {
                    // entry removed before load — ignore
                }
            },
        }),
        // A single DM thread (+ the other user's profile). Live via `dm:new`: a
        // message belongs to THIS thread when the other party is the sender or the
        // recipient, regardless of who sent it.
        getDmThread: builder.query({
            query: (userId) => `chat/dm/${userId}`,
            transformResponse: (res) => res?.data ?? { user: null, messages: [] },
            providesTags: (r, e, userId) => [{ type: "DmThread", id: userId }],
            async onCacheEntryAdded(
                userId,
                { getState, updateCachedData, cacheDataLoaded, cacheEntryRemoved }
            ) {
                const token = getState().auth?.token;
                const socket = token ? getSocket(token) : null;
                try {
                    await cacheDataLoaded;
                    if (!socket) return;
                    const onNew = (msg) => {
                        const inThread =
                            (msg?.sender?.id ?? msg?.sender_id) === userId ||
                            msg?.recipient_id === userId;
                        if (!inThread) return;
                        updateCachedData((draft) => {
                            if (draft.messages.some((m) => m.id === msg.id)) return;
                            draft.messages.push(msg);
                        });
                    };
                    // Reaction change -> swap that message's grouped reactions (if the
                    // message is in this thread's cache).
                    const onReaction = ({ message_id, reactions }) => {
                        updateCachedData((draft) => {
                            const m = draft.messages.find((x) => x.id === message_id);
                            if (m) m.reactions = reactions;
                        });
                    };
                    socket.on("dm:new", onNew);
                    socket.on("dm:reaction", onReaction);
                    await cacheEntryRemoved;
                    socket.off("dm:new", onNew);
                    socket.off("dm:reaction", onReaction);
                } catch {
                    // entry removed before load — ignore
                }
            },
        }),
        // Send a DM (text and/or image). Appends the result instantly (socket echo
        // is de-duped by id) and refreshes the conversation list preview.
        sendDm: builder.mutation({
            query: ({ userId, content, attachment_url, reply_to_id }) => ({
                url: `chat/dm/${userId}`,
                method: "POST",
                body: { content, attachment_url, reply_to_id },
            }),
            async onQueryStarted({ userId }, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled;
                    const msg = data?.data;
                    if (!msg) return;
                    dispatch(
                        apiSlice.util.updateQueryData("getDmThread", userId, (draft) => {
                            if (!draft.messages.some((m) => m.id === msg.id)) draft.messages.push(msg);
                        })
                    );
                } catch {
                    // surfaced at call site
                }
            },
            invalidatesTags: [{ type: "Conversations", id: "LIST" }],
        }),
        // Toggle an emoji reaction on a DM. Optimistically updates the thread; the
        // socket echo (dm:reaction) keeps both parties in sync.
        reactDm: builder.mutation({
            query: ({ userId, messageId, emoji }) => ({
                url: `chat/dm/${userId}/messages/${messageId}/reactions`,
                method: "POST",
                body: { emoji },
            }),
            async onQueryStarted({ userId, messageId }, { dispatch, queryFulfilled }) {
                try {
                    const { data } = await queryFulfilled;
                    const reactions = data?.data?.reactions;
                    if (!reactions) return;
                    dispatch(
                        apiSlice.util.updateQueryData("getDmThread", userId, (draft) => {
                            const m = draft.messages.find((x) => x.id === messageId);
                            if (m) m.reactions = reactions;
                        })
                    );
                } catch {
                    // surfaced at call site
                }
            },
        }),
        // Mark a DM thread read (clears its unread badge).
        markDmRead: builder.mutation({
            query: (userId) => ({ url: `chat/dm/${userId}/read`, method: "POST" }),
            invalidatesTags: [{ type: "Conversations", id: "LIST" }],
        }),

        // ---- Bookings ----
        // Create a booking. Body: { ground_id, booking_date, slot, paid?,
        // transaction_id?, payment_proof_url?, event_id?, promo_code?, notes? }.
        // "paid" = supplying a transaction_id or payment_proof_url (locks the slot,
        // awaits admin verification); otherwise an unpaid soft hold.
        createBooking: builder.mutation({
            query: (body) => ({ url: "bookings/create", method: "POST", body }),
            invalidatesTags: [
                { type: "Bookings", id: "MINE" },
                { type: "Bookings", id: "MANAGE" },
                { type: "Bookings", id: "STATS" }, // keep the dashboard overview fresh
                { type: "Bookings", id: "SLOTS" }, // the slot grid shows own bookings + holds
            ],
        }),
        // My bookings (GET /bookings/my).
        getMyBookings: builder.query({
            query: () => "bookings/my",
            transformResponse: (res) => res?.data?.bookings ?? [],
            providesTags: [{ type: "Bookings", id: "MINE" }],
        }),
        // Single booking detail (owner or turf admin) — includes event_trust.
        getBookingById: builder.query({
            query: (bookingId) => `bookings/${bookingId}`,
            transformResponse: (res) => res?.data ?? null,
            providesTags: (r, e, bookingId) => [{ type: "Booking", id: bookingId }],
        }),
        // Resolve a printed ticket reference (FT-XXXXXXXX) to a booking, for
        // MANUAL verification. Admin-scoped server-side. Used via the lazy hook.
        verifyBookingLookup: builder.query({
            query: (code) => ({ url: "bookings/verify-lookup", params: { code } }),
            transformResponse: (res) => res?.data ?? null,
        }),
        // Turf-admin dashboard analytics roll-up (GET /bookings/dashboard-stats).
        getDashboardStats: builder.query({
            query: () => "bookings/dashboard-stats",
            transformResponse: (res) => res?.data ?? null,
            providesTags: [{ type: "Bookings", id: "STATS" }],
        }),
        // Turf-admin management list (GET /bookings/manage?status=).
        getManageBookings: builder.query({
            query: (params) => ({ url: "bookings/manage", params }),
            transformResponse: (res) => res?.data?.bookings ?? [],
            providesTags: [{ type: "Bookings", id: "MANAGE" }],
        }),
        // Turf admin confirms a paid booking's payment.
        confirmBookingPayment: builder.mutation({
            query: ({ bookingId, admin_notes }) => ({
                url: `bookings/${bookingId}/confirm-payment`,
                method: "POST",
                body: { admin_notes },
            }),
            invalidatesTags: (r, e, { bookingId }) => [
                { type: "Booking", id: bookingId },
                { type: "Bookings", id: "MANAGE" },
                { type: "Bookings", id: "STATS" }, // keep the dashboard overview fresh
                { type: "Bookings", id: "MINE" },
                { type: "Bookings", id: "SLOTS" }, // payment state changes the grid too
            ],
        }),
        // Turf admin rejects a paid claim (reverts to unpaid hold).
        rejectBookingPayment: builder.mutation({
            query: ({ bookingId, admin_notes }) => ({
                url: `bookings/${bookingId}/reject-payment`,
                method: "POST",
                body: { admin_notes },
            }),
            invalidatesTags: (r, e, { bookingId }) => [
                { type: "Booking", id: bookingId },
                { type: "Bookings", id: "MANAGE" },
                { type: "Bookings", id: "STATS" }, // keep the dashboard overview fresh
                { type: "Bookings", id: "MINE" },
                { type: "Bookings", id: "SLOTS" }, // payment state changes the grid too
            ],
        }),
        // Cancel a booking (owner or admin). May open a mutual-cancel request.
        cancelBooking: builder.mutation({
            query: ({ bookingId, reason }) => ({
                url: `bookings/${bookingId}/cancel`,
                method: "POST",
                body: { reason },
            }),
            invalidatesTags: (r, e, { bookingId }) => [
                { type: "Booking", id: bookingId },
                { type: "Bookings", id: "MINE" },
                { type: "Bookings", id: "MANAGE" },
                { type: "Bookings", id: "STATS" }, // keep the dashboard overview fresh
                { type: "Bookings", id: "SLOTS" }, // the slot grid shows own bookings + holds
            ],
        }),
        // Turf admin checks a player in by scanning their ticket QR.
        checkInBooking: builder.mutation({
            query: (bookingId) => ({
                url: `bookings/${bookingId}/check-in`,
                method: "POST",
            }),
            invalidatesTags: (r, e, bookingId) => [
                { type: "Booking", id: bookingId },
                { type: "Bookings", id: "MANAGE" },
                { type: "Bookings", id: "STATS" }, // keep the dashboard overview fresh
                { type: "Bookings", id: "MINE" },
            ],
        }),
        // Respond to a mutual cancellation request ({ accept: boolean }).
        respondCancellation: builder.mutation({
            query: ({ bookingId, accept }) => ({
                url: `bookings/${bookingId}/cancel/respond`,
                method: "POST",
                body: { accept },
            }),
            invalidatesTags: (r, e, { bookingId }) => [
                { type: "Booking", id: bookingId },
                { type: "Bookings", id: "MINE" },
                { type: "Bookings", id: "MANAGE" },
                { type: "Bookings", id: "STATS" }, // keep the dashboard overview fresh
                { type: "Bookings", id: "SLOTS" }, // the slot grid shows own bookings + holds
            ],
        }),

        // ---- Event comments ----
        // Reading is public; the payload also carries `can_comment`, the server's
        // verdict on whether this caller may post (approved player / organizer).
        getComments: builder.query({
            query: (eventId) => `events/${eventId}/comments`,
            transformResponse: (res) => res?.data ?? { comments: [], can_comment: false },
            providesTags: (r, e, eventId) => [{ type: "Comments", id: eventId }],
        }),
        createComment: builder.mutation({
            query: ({ eventId, content, parent_comment_id }) => ({
                url: `events/${eventId}/comments`,
                method: "POST",
                body: { content, parent_comment_id },
            }),
            invalidatesTags: (r, e, { eventId }) => [{ type: "Comments", id: eventId }],
        }),
        updateComment: builder.mutation({
            query: ({ eventId, commentId, content }) => ({
                url: `events/${eventId}/comments/${commentId}`,
                method: "PATCH",
                body: { content },
            }),
            invalidatesTags: (r, e, { eventId }) => [{ type: "Comments", id: eventId }],
        }),
        deleteComment: builder.mutation({
            query: ({ eventId, commentId }) => ({
                url: `events/${eventId}/comments/${commentId}`,
                method: "DELETE",
            }),
            invalidatesTags: (r, e, { eventId }) => [{ type: "Comments", id: eventId }],
        }),
        toggleCommentLike: builder.mutation({
            query: ({ eventId, commentId }) => ({
                url: `events/${eventId}/comments/${commentId}/like`,
                method: "POST",
            }),
            // Optimistic: a like must feel instant. Patch the cached thread, and
            // roll back if the server disagrees.
            async onQueryStarted({ eventId, commentId }, { dispatch, queryFulfilled }) {
                const patch = dispatch(
                    apiSlice.util.updateQueryData("getComments", eventId, (draft) => {
                        const c = draft.comments?.find((x) => x.id === commentId);
                        if (!c) return;
                        c.liked_by_me = !c.liked_by_me;
                        c.likes_count = Math.max((c.likes_count ?? 0) + (c.liked_by_me ? 1 : -1), 0);
                    })
                );
                try {
                    await queryFulfilled;
                } catch {
                    patch.undo();
                }
            },
        }),
    }),
});

export const {
    useGetVenuesQuery,
    useGetVenuesByAdminQuery,
    useGetVenueByIdQuery,
    useRateTurfMutation,
    useGetPromotionsQuery,
    useGetPromotionAnalyticsQuery,
    useCreatePromotionMutation,
    useUpdatePromotionMutation,
    useDeletePromotionMutation,
    useCreateVenueMutation,
    useCreateGroundMutation,
    useUpdateGroundMutation,
    useGetEventsQuery,
    useGetEventByIdQuery,
    useCreateEventMutation,
    useGetMyEventsQuery,
    useUpdateEventMutation,
    useRematchEventMutation,
    useDeleteEventMutation,
    useGetNotificationsQuery,
    useMarkNotificationReadMutation,
    useMarkAllNotificationsReadMutation,
    useDeleteNotificationMutation,
    useGetAvailableSlotsQuery,
    useGetBookingQuoteQuery,
    useGetAvailableCouponsQuery,
    useGetUserByIdQuery,
    useRegisterUserMutation,
    useGetTurfmatesQuery,
    useGetTurfmateRequestsQuery,
    useGetOutgoingRequestsQuery,
    useGetTurfmateRecommendationsQuery,
    useGetConnectionStatusQuery,
    useGetMutualTurfmatesQuery,
    useSendTurfmateRequestMutation,
    useAcceptTurfmateRequestMutation,
    useRejectTurfmateRequestMutation,
    useCancelTurfmateRequestMutation,
    useRemoveTurfmateMutation,
    // teams
    useGetSportsCatalogueQuery,
    useGetMyTeamsQuery,
    useGetTeamByIdQuery,
    useCreateTeamMutation,
    useUpdateTeamMutation,
    useDeleteTeamMutation,
    useGetTeamEventsQuery,
    useGetMyTeamInvitesQuery,
    useGetTeamInvitesQuery,
    useSendTeamInviteMutation,
    useAcceptTeamInviteMutation,
    useDeclineTeamInviteMutation,
    useCancelTeamInviteMutation,
    useUpdateTeamMemberMutation,
    useRemoveTeamMemberMutation,
    useTransferCaptaincyMutation,
    useJoinEventMutation,
    useCancelJoinRequestMutation,
    useLeaveEventMutation,
    useAcceptEventInvitationMutation,
    useDeclineEventInvitationMutation,
    useGetJoinRequestsQuery,
    useAcceptJoinRequestMutation,
    useRejectJoinRequestMutation,
    useGrantEventAdminMutation,
    useRevokeEventAdminMutation,
    // event chat
    useGetEventMessagesQuery,
    useSendEventMessageMutation,
    useEditEventMessageMutation,
    useDeleteEventMessageMutation,
    useReactEventMessageMutation,
    useMarkEventChatReadMutation,
    // direct messages + conversations
    useGetConversationsQuery,
    useGetDmThreadQuery,
    useSendDmMutation,
    useReactDmMutation,
    useMarkDmReadMutation,
    useCreateBookingMutation,
    useGetMyBookingsQuery,
    useGetBookingByIdQuery,
    useLazyGetBookingByIdQuery,
    useLazyVerifyBookingLookupQuery,
    useGetManageBookingsQuery,
    useGetDashboardStatsQuery,
    useConfirmBookingPaymentMutation,
    useRejectBookingPaymentMutation,
    useCancelBookingMutation,
    useRespondCancellationMutation,
    useCheckInBookingMutation,
    // comments
    useGetCommentsQuery,
    useCreateCommentMutation,
    useUpdateCommentMutation,
    useDeleteCommentMutation,
    useToggleCommentLikeMutation,
} = apiSlice;
