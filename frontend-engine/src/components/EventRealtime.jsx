"use client";

import { getSocket } from "@/lib/socket";
import { apiSlice } from "@/store/api/apiSlice";
import { selectToken } from "@/store/slices/authSlice";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";

/**
 * Keeps a match page live. Mounted once on the event page, it:
 *   - subscribes this socket to the match's `event:<id>` room, and
 *   - on any `event:roster` push (someone requested/joined/left/was accepted),
 *     invalidates the Event + JoinRequests caches so the squad list and the admin
 *     request queue refetch instantly — no manual refresh.
 *
 * Renders nothing. Chat has its own live channel (see EventChat) and doesn't ride
 * on the roster room, so private messages never leak to non-members.
 */
export default function EventRealtime({ eventId }) {
    const token = useSelector(selectToken);
    const dispatch = useDispatch();

    useEffect(() => {
        if (!eventId || !token) return;
        const socket = getSocket(token);
        if (!socket) return;

        const subscribe = () => socket.emit("event:subscribe", eventId);
        subscribe();
        socket.on("connect", subscribe); // re-join the room after a reconnect

        const onRoster = (payload) => {
            if (payload?.eventId && payload.eventId !== eventId) return;
            dispatch(
                apiSlice.util.invalidateTags([
                    { type: "Event", id: eventId },
                    { type: "JoinRequests", id: eventId },
                ])
            );
        };
        socket.on("event:roster", onRoster);

        return () => {
            socket.emit("event:unsubscribe", eventId);
            socket.off("event:roster", onRoster);
            socket.off("connect", subscribe);
        };
    }, [eventId, token, dispatch]);

    return null;
}
