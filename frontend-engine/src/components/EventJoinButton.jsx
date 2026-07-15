"use client";

import { notifyError, notifySuccess } from "@/lib/notify";
import { useSession } from "next-auth/react";
import { Clock, Loader2, LogIn, UserMinus, UserPlus } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";
import { getApiErrorMessage } from "@/utils/apiError";
import {
    useJoinEventMutation,
    useCancelJoinRequestMutation,
    useLeaveEventMutation,
    useGetEventByIdQuery,
} from "@/store/api/apiSlice";

// Stateful join CTA for the event page. Joining is an approval flow, so the
// button reflects the caller's live participation:
//   signed out          -> Sign in to join
//   organizer           -> disabled "You're the organizer"
//   approved            -> Leave match
//   requested (pending) -> Requested — tap to cancel
//   none / rejected     -> Request to Join (disabled when full)
export default function EventJoinButton({ event: initialEvent, isFull: initialIsFull }) {
    const { data: session } = useSession();
    const me = session?.user?.id;
    const eventId = initialEvent?.id;

    // Read the event LIVE so the button reflects real-time roster changes (my
    // request accepted elsewhere, the squad filling up) without a refresh. Seeded
    // by the server's initial fetch passed in as `initialEvent`.
    const { data } = useGetEventByIdQuery(eventId, { skip: !eventId });
    const event = data ?? initialEvent;
    const organizerId = event?.organizer?.id;

    // Recompute fullness from live data; fall back to the server's value.
    const min = event?.min_players ?? 0;
    const cur = event?.current_players ?? 0;
    const isFull = min > 0 ? cur >= min : Boolean(initialIsFull);

    const [join, joinState] = useJoinEventMutation();
    const [cancel, cancelState] = useCancelJoinRequestMutation();
    const [leave, leaveState] = useLeaveEventMutation();
    const busy = joinState.isLoading || cancelState.isLoading || leaveState.isLoading;

    const spinner = <Loader2 className="h-4 w-4 animate-spin" />;

    if (!session) {
        return (
            <Button asChild size="lg" className="rounded-full px-8 green-glow">
                <Link href="/login">
                    <LogIn className="h-4 w-4" /> Sign in to join
                </Link>
            </Button>
        );
    }

    if (me && organizerId && me === organizerId) {
        return (
            <Button size="lg" variant="outline" className="rounded-full px-8" disabled>
                You&apos;re the organizer
            </Button>
        );
    }

    // My participation row (if any). Rows carry either user_id or nested users.id.
    const mine = (event?.participants || []).find(
        (p) => (p.user_id ?? p.users?.id) === me
    );
    const status = mine?.status;

    // Fire a mutation and surface the outcome (EVENT_FULL, etc.).
    //
    // Success is TOAST-ONLY — these are the user's own actions, so the backend
    // deliberately writes no notification for them (the bell would just echo what
    // they just did). The bell entry comes later, when an admin actually decides.
    const run = async (fn, successMessage, description) => {
        try {
            await fn(eventId).unwrap();
            if (successMessage) notifySuccess(successMessage, description);
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Something went wrong."));
        }
    };

    if (status === "approved") {
        return (
            <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8"
                disabled={busy}
                onClick={() => run(leave, "You left the match")}
            >
                {busy ? spinner : <UserMinus className="h-4 w-4" />} Leave match
            </Button>
        );
    }

    if (status === "requested") {
        return (
            <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8"
                disabled={busy}
                onClick={() => run(cancel, "Request withdrawn")}
            >
                {busy ? spinner : <Clock className="h-4 w-4" />} Requested — tap to cancel
            </Button>
        );
    }

    // none / rejected -> can (re)request
    return (
        <Button
            size="lg"
            className="rounded-full px-8 green-glow"
            disabled={busy || isFull}
            onClick={() =>
                run(join, "Request sent", "The organizers will review it shortly.")
            }
        >
            {busy ? spinner : <UserPlus className="h-4 w-4" />}
            {isFull ? "Squad full" : "Request to Join"}
        </Button>
    );
}
