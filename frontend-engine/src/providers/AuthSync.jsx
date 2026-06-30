"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useDispatch } from "react-redux";
import { clearCredentials, setCredentials } from "@/store/slices/authSlice";

// Bridges the NextAuth session into the Redux auth slice so RTK Query's
// prepareHeaders can attach the bearer token to API calls.
export default function AuthSync() {
    const { data: session, status } = useSession();
    const dispatch = useDispatch();

    useEffect(() => {
        if (status === "authenticated") {
            dispatch(
                setCredentials({
                    user: session.user,
                    token: session.user?.access_token ?? null,
                })
            );
        } else if (status === "unauthenticated") {
            dispatch(clearCredentials());
        }
    }, [status, session, dispatch]);

    return null;
}
