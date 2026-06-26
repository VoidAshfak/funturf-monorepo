import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { apiSlice } from "./api/apiSlice";
import authReducer from "./slices/authSlice";
import filtersReducer from "./slices/filtersSlice";

export const makeStore = () => {
    const store = configureStore({
        reducer: {
            [apiSlice.reducerPath]: apiSlice.reducer,
            auth: authReducer,
            filters: filtersReducer,
        },
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware().concat(apiSlice.middleware),
    });

    // enables refetchOnFocus / refetchOnReconnect behaviours
    setupListeners(store.dispatch);
    return store;
};
