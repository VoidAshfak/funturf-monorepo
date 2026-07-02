import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

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
    tagTypes: ["Venues", "Venue", "Events", "Event", "User", "Turfmates", "TurfmateRequests"],
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
        getEvents: builder.query({
            query: () => "events",
            transformResponse: (res) => res?.data ?? [],
            providesTags: (result) =>
                result
                    ? [
                          ...result.map((e) => ({ type: "Event", id: e.id })),
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
        }),
        // Price quote for a single slot (GET /bookings/quote?ground_id=&slot=&booking_date=&promo_code=).
        getBookingQuote: builder.query({
            query: ({ ground_id, slot, booking_date, promo_code }) => ({
                url: "bookings/quote",
                params: { ground_id, slot, booking_date, promo_code },
            }),
            transformResponse: (res) => res?.data ?? null,
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
        // Accepted connections -> array of the other party's user ids.
        getTurfmates: builder.query({
            query: () => "turfmates/get-turfmates",
            transformResponse: (res) => res?.data ?? [],
            providesTags: [{ type: "Turfmates", id: "LIST" }],
        }),
        // Incoming pending requests for the logged-in user.
        getTurfmateRequests: builder.query({
            query: () => "turfmates/get-pending-requests",
            transformResponse: (res) => res?.data ?? [],
            providesTags: [{ type: "TurfmateRequests", id: "LIST" }],
        }),
        // Mutual turfmates between me and another user (GET ?userTwo=).
        getMutualTurfmates: builder.query({
            query: (userTwo) => ({
                url: "turfmates/get-mutual-turfmates",
                params: { userTwo },
            }),
            transformResponse: (res) => res?.data ?? [],
        }),
        sendTurfmateRequest: builder.mutation({
            query: (receiverId) => ({
                url: "turfmates/turfmate-request",
                method: "POST",
                body: { receiverId },
            }),
            invalidatesTags: [{ type: "TurfmateRequests", id: "LIST" }],
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
            ],
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
    useGetAvailableSlotsQuery,
    useGetBookingQuoteQuery,
    useGetUserByIdQuery,
    useRegisterUserMutation,
    useGetTurfmatesQuery,
    useGetTurfmateRequestsQuery,
    useGetMutualTurfmatesQuery,
    useSendTurfmateRequestMutation,
    useAcceptTurfmateRequestMutation,
} = apiSlice;
