import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    events: {
        query: "",
        sport: "all",
        timeframe: "all",
        openOnly: false,
        // Show ONLY matches the signed-in user is involved in (organiser or
        // participant) — a "my matches" view of the feed.
        joinedOnly: false,
        page: 1,
    },
    venues: {
        query: "",
        sport: "all",
        sort: "recommended",
        topRated: false,
        page: 1,
    },
};

const filtersSlice = createSlice({
    name: "filters",
    initialState,
    reducers: {
        // events — any filter change resets pagination to page 1
        setEventFilter: (state, action) => {
            const { key, value } = action.payload;
            state.events[key] = value;
            if (key !== "page") state.events.page = 1;
        },
        setEventPage: (state, action) => {
            state.events.page = action.payload;
        },
        resetEventFilters: (state) => {
            state.events = initialState.events;
        },

        // venues
        setVenueFilter: (state, action) => {
            const { key, value } = action.payload;
            state.venues[key] = value;
            if (key !== "page") state.venues.page = 1;
        },
        setVenuePage: (state, action) => {
            state.venues.page = action.payload;
        },
        resetVenueFilters: (state) => {
            state.venues = initialState.venues;
        },
    },
});

export const {
    setEventFilter,
    setEventPage,
    resetEventFilters,
    setVenueFilter,
    setVenuePage,
    resetVenueFilters,
} = filtersSlice.actions;

export const selectEventFilters = (state) => state.filters.events;
export const selectVenueFilters = (state) => state.filters.venues;

export default filtersSlice.reducer;
