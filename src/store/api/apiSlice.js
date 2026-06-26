import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

// Same hardcoded backend base used across the app (see getData.js / NextAuth route).
const BASE_URL = "https://app4-osju.onrender.com/api/v1/";

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
    tagTypes: ["Venues", "Venue", "Events", "Event", "User"],
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
    useGetUserByIdQuery,
    useRegisterUserMutation,
} = apiSlice;
