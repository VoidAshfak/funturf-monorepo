"use client";

import { useEffect } from "react";
import { signOut, useSession } from "next-auth/react";
import { useDispatch } from "react-redux";
import { clearCredentials, setCredentials } from "@/store/slices/authSlice";

// Bridges the NextAuth session into the Redux auth slice so RTK Query's
// prepareHeaders can attach the bearer token to API calls.
export default function AuthSync() {
    const { data: session, status } = useSession();
    const dispatch = useDispatch();

    useEffect(() => {
        if (status === "authenticated") {
            // The NextAuth jwt callback couldn't refresh the backend access token
            // (dead/rotated refresh token) — the session is unusable, so log out.
            if (session?.error === "RefreshAccessTokenError") {
                dispatch(clearCredentials());
                signOut({ callbackUrl: "/login" });
                return;
            }
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
