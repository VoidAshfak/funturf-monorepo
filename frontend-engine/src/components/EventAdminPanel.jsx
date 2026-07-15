"use client";

import { notifyError } from "@/lib/notify";
import { useSession } from "next-auth/react";
import {
    Check,
    Inbox,
    Loader2,
    Shield,
    ShieldMinus,
    ShieldPlus,
    X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { getApiErrorMessage } from "@/utils/apiError";
import {
    useGetJoinRequestsQuery,
    useAcceptJoinRequestMutation,
    useRejectJoinRequestMutation,
    useGrantEventAdminMutation,
    useRevokeEventAdminMutation,
    useGetEventByIdQuery,
} from "@/store/api/apiSlice";

const fullName = (u) =>
    [u?.first_name, u?.last_name].filter(Boolean).join(" ") || "Player";
const initials = (u) => fullName(u).slice(0, 2).toUpperCase();

// Admin moderation card for the event page. Visible only to event admins
// (organizer or an approved co_organizer). Lists pending join requests with
// accept/reject; the ORGANIZER additionally gets make/remove-admin controls over
// the approved roster.
export default function EventAdminPanel({ event: initialEvent }) {
    const { data: session } = useSession();
    const me = session?.user?.id;
    const eventId = initialEvent?.id;

    // Live event so the approved roster (admin detection, manage-admins list)
    // reflects real-time changes. Seeded by the server's initial fetch.
    const { data } = useGetEventByIdQuery(eventId, { skip: !eventId });
    const event = data ?? initialEvent;
    const organizerId = event?.organizer?.id;
    const participants = event?.participants || [];

    const isOrganizer = !!me && me === organizerId;
    const isCoOrganizer = participants.some(
        (p) =>
            (p.user_id ?? p.users?.id) === me &&
            p.role === "co_organizer" &&
            p.status === "approved"
    );
    const isAdmin = isOrganizer || isCoOrganizer;

    // Hooks must run unconditionally; skip the fetch when the caller isn't an admin.
    const { data: requests = [], isLoading } = useGetJoinRequestsQuery(eventId, {
        skip: !isAdmin || !eventId,
    });
    const [accept, acceptState] = useAcceptJoinRequestMutation();
    const [reject, rejectState] = useRejectJoinRequestMutation();
    const [grant, grantState] = useGrantEventAdminMutation();
    const [revoke, revokeState] = useRevokeEventAdminMutation();
    const busy =
        acceptState.isLoading ||
        rejectState.isLoading ||
        grantState.isLoading ||
        revokeState.isLoading;

    if (!isAdmin) return null;

    const run = async (fn, arg) => {
        try {
            await fn(arg).unwrap();
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Something went wrong."));
        }
    };

    // Approved roster the organizer can promote/demote (exclude the organizer).
    const roster = participants.filter(
        (p) => p.status === "approved" && (p.user_id ?? p.users?.id) !== organizerId
    );

    return (
        <div className="glass-card mb-6 rounded-3xl p-5 md:p-7">
            <div className="mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">Join requests</h2>
                <span className="ml-auto rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
                    {requests.length} pending
                </span>
            </div>

            {isLoading ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </p>
            ) : requests.length === 0 ? (
                <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
                    <Inbox className="h-4 w-4" /> No pending requests.
                </div>
            ) : (
                <ul className="space-y-2">
                    {requests.map((r) => (
                        <li
                            key={r.id}
                            className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-accent"
                        >
                            <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                                <AvatarImage
                                    src={r.users?.profile_picture_url || undefined}
                                    alt={fullName(r.users)}
                                />
                                <AvatarFallback>{initials(r.users)}</AvatarFallback>
                            </Avatar>
                            <p className="min-w-0 flex-1 truncate font-semibold text-foreground">
                                {fullName(r.users)}
                            </p>
                            <Button
                                size="sm"
                                className="rounded-full green-glow"
                                disabled={busy}
                                onClick={() => run(accept, { eventId, userId: r.user_id })}
                            >
                                <Check className="h-4 w-4" /> Accept
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                disabled={busy}
                                onClick={() => run(reject, { eventId, userId: r.user_id })}
                            >
                                <X className="h-4 w-4" /> Reject
                            </Button>
                        </li>
                    ))}
                </ul>
            )}

            {/* Manage admins — organizer only */}
            {isOrganizer && roster.length > 0 && (
                <div className="mt-6 border-t border-border pt-5">
                    <h3 className="mb-3 text-sm font-bold text-foreground">Manage admins</h3>
                    <ul className="space-y-2">
                        {roster.map((p) => {
                            const uid = p.user_id ?? p.users?.id;
                            const isCo = p.role === "co_organizer";
                            return (
                                <li
                                    key={p.id}
                                    className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-accent"
                                >
                                    <Avatar className="h-9 w-9 ring-2 ring-primary/20">
                                        <AvatarImage
                                            src={p.users?.profile_picture_url || undefined}
                                            alt={fullName(p.users)}
                                        />
                                        <AvatarFallback>{initials(p.users)}</AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-semibold text-foreground">
                                            {fullName(p.users)}
                                        </p>
                                        {isCo && (
                                            <p className="text-xs font-medium text-primary">Admin</p>
                                        )}
                                    </div>
                                    {isCo ? (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="rounded-full"
                                            disabled={busy}
                                            onClick={() => run(revoke, { eventId, userId: uid })}
                                        >
                                            <ShieldMinus className="h-4 w-4" /> Remove admin
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="rounded-full"
                                            disabled={busy}
                                            onClick={() => run(grant, { eventId, userId: uid })}
                                        >
                                            <ShieldPlus className="h-4 w-4" /> Make admin
                                        </Button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
}
