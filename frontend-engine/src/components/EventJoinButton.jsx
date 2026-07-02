"use client";

import { useSession } from "next-auth/react";
import { Clock, Loader2, LogIn, UserMinus, UserPlus } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui/button";
import { getApiErrorMessage } from "@/utils/apiError";
import {
    useJoinEventMutation,
    useCancelJoinRequestMutation,
    useLeaveEventMutation,
} from "@/store/api/apiSlice";

// Stateful join CTA for the event page. Joining is an approval flow, so the
// button reflects the caller's live participation:
//   signed out          -> Sign in to join
//   organizer           -> disabled "You're the organizer"
//   approved            -> Leave match
//   requested (pending) -> Requested — tap to cancel
//   none / rejected     -> Request to Join (disabled when full)
export default function EventJoinButton({ event, isFull }) {
    const { data: session } = useSession();
    const me = session?.user?.id;
    const eventId = event?.id;
    const organizerId = event?.organizer?.id;

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

    // Fire a mutation and surface any backend error (EVENT_FULL, etc.).
    const run = async (fn) => {
        try {
            await fn(eventId).unwrap();
        } catch (err) {
            alert(getApiErrorMessage(err, "Something went wrong."));
        }
    };

    if (status === "approved") {
        return (
            <Button
                size="lg"
                variant="outline"
                className="rounded-full px-8"
                disabled={busy}
                onClick={() => run(leave)}
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
                onClick={() => run(cancel)}
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
            onClick={() => run(join)}
        >
            {busy ? spinner : <UserPlus className="h-4 w-4" />}
            {isFull ? "Squad full" : "Request to Join"}
        </Button>
    );
}
