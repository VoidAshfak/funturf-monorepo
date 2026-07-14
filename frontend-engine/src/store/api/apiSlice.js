import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { getSocket } from "@/lib/socket";
import { toastIncomingNotification } from "@/lib/notify";

// Backend base from env (NEXT_PUBLIC_ so it's exposed client-side); see getData.js / NextAuth route.
const BASE_URL = `${process.env.NEXT_PUBLIC_API_BASE_URL}/`;

export const apiSlice = createApi({
    reducerPath: "api",
    baseQuery: fetchBaseQuery({
        baseUrl: BASE_URL,
        prepareHeaders: (headers, { getState }) => {
            // token is synced from the NextAuth session into authSlice (see AuthSync)
            const token = getState().auth?.token;
            if (token) headers.set("authorization", `Bearer ${token}`);
            return headers;
        },
    }),
    tagTypes: ["Venues", "Venue", "Events", "Event", "JoinRequests", "Comments", "Bookings", "Booking", "User", "Turfmates", "TurfmateRequests", "TurfmateRecs", "ConnectionStatus", "Notifications"],
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

        // ---- Events ----
        // Paginated infinite-scroll feed. Args: { page, limit, sport, timeframe, q, openOnly }.
        // Pages accumulate into one cache entry per filter set: `serializeQueryArgs`
        // drops `page` from the cache key, `merge` appends each new page, and
        // `forceRefetch` re-runs the query whenever `page` changes.
        getEvents: builder.query({
            query: ({ page = 1, limit = 12, sport, timeframe, q, openOnly } = {}) => ({
                url: "events",
                params: { page, limit, sport, timeframe, q, openOnly },
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
            invalidatesTags: [{ type: "Events", id: "LIST" }],
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
        // Organizer-only delete (DELETE /events/delete-event, event_id in body).
        deleteEvent: builder.mutation({
            query: (eventId) => ({
                url: "events/delete-event",
                method: "DELETE",
                body: { event_id: eventId },
            }),
            invalidatesTags: [
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
                { type: "Bookings", id: "SLOTS" }, // the slot grid shows own bookings + holds
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
    useCreateVenueMutation,
    useGetEventsQuery,
    useGetEventByIdQuery,
    useCreateEventMutation,
    useGetMyEventsQuery,
    useUpdateEventMutation,
    useDeleteEventMutation,
    useGetNotificationsQuery,
    useMarkNotificationReadMutation,
    useMarkAllNotificationsReadMutation,
    useDeleteNotificationMutation,
    useGetAvailableSlotsQuery,
    useGetBookingQuoteQuery,
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
    useJoinEventMutation,
    useCancelJoinRequestMutation,
    useLeaveEventMutation,
    useGetJoinRequestsQuery,
    useAcceptJoinRequestMutation,
    useRejectJoinRequestMutation,
    useGrantEventAdminMutation,
    useRevokeEventAdminMutation,
    useCreateBookingMutation,
    useGetMyBookingsQuery,
    useGetBookingByIdQuery,
    useGetManageBookingsQuery,
    useConfirmBookingPaymentMutation,
    useRejectBookingPaymentMutation,
    useCancelBookingMutation,
    useRespondCancellationMutation,
    // comments
    useGetCommentsQuery,
    useCreateCommentMutation,
    useUpdateCommentMutation,
    useDeleteCommentMutation,
    useToggleCommentLikeMutation,
} = apiSlice;
