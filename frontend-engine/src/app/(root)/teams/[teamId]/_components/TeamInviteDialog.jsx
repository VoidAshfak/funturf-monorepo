"use client";

import { useMemo, useState } from "react";
import { Clock, Search, UserPlus, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    useCancelTeamInviteMutation,
    useGetTeamInvitesQuery,
    useGetTurfmatesQuery,
    useSendTeamInviteMutation,
} from "@/store/api/apiSlice";
import { notifyError, notifySuccess } from "@/lib/notify";
import { getApiErrorMessage } from "@/utils/apiError";
import { playerInitials, playerName } from "@/utils/teams";

/**
 * Recruit players onto the team.
 *
 * Candidates come from the caller's turfmates — the people they already play
 * with are who they actually want on the squad, and it avoids shipping a
 * user-search endpoint this pass. Anyone already on the roster or already
 * invited is filtered out client-side; the backend enforces the same rules
 * (`ALREADY_TEAM_MEMBER` / `TEAM_INVITE_ALREADY_EXISTS`) regardless.
 *
 * Only rendered for a captain or co-captain — see TeamRoster.
 */
export default function TeamInviteDialog({ open, onOpenChange, teamId, memberIds = [] }) {
    const [query, setQuery] = useState("");

    const turfmatesQ = useGetTurfmatesQuery(undefined, { skip: !open });
    const invitesQ = useGetTeamInvitesQuery({ teamId }, { skip: !open || !teamId });
    const [sendInvite, { isLoading: sending }] = useSendTeamInviteMutation();
    const [cancelInvite] = useCancelTeamInviteMutation();

    const pending = invitesQ.data?.invites ?? [];
    const pendingIds = useMemo(() => new Set(pending.map((i) => i.user?.id)), [pending]);
    const onRoster = useMemo(() => new Set(memberIds), [memberIds]);

    const candidates = useMemo(() => {
        const term = query.trim().toLowerCase();
        return (turfmatesQ.data?.turfmates ?? [])
            .filter((p) => !onRoster.has(p.id) && !pendingIds.has(p.id))
            .filter((p) => (term ? playerName(p).toLowerCase().includes(term) : true));
    }, [turfmatesQ.data, onRoster, pendingIds, query]);

    const invite = async (player) => {
        try {
            await sendInvite({ teamId, invitedUserId: player.id }).unwrap();
            notifySuccess(`Invite sent to ${playerName(player)}`);
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Could not send that invite."));
        }
    };

    const withdraw = async (inviteId) => {
        try {
            await cancelInvite({ inviteId, teamId }).unwrap();
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Could not withdraw that invite."));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Invite players</DialogTitle>
                    <DialogDescription>
                        Pull in the turfmates you already play with. They'll get a notification and
                        decide for themselves.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search your turfmates"
                        className="pl-9"
                    />
                </div>

                {/* Already out — withdrawable until they answer. */}
                {pending.length > 0 && (
                    <section className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Awaiting a reply
                        </h3>
                        {pending.map((i) => (
                            <Row
                                key={i.inviteId}
                                person={i.user}
                                meta={
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        Pending
                                    </span>
                                }
                                action={
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full"
                                        onClick={() => withdraw(i.inviteId)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                }
                            />
                        ))}
                    </section>
                )}

                <section className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Your turfmates
                    </h3>
                    {turfmatesQ.isLoading ? (
                        <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : candidates.length === 0 ? (
                        <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                            {query
                                ? "Nobody matches that search."
                                : "Everyone you're connected with is already on the team or invited. Add more turfmates to grow the squad."}
                        </p>
                    ) : (
                        candidates.map((person) => (
                            <Row
                                key={person.id}
                                person={person}
                                action={
                                    <Button
                                        size="sm"
                                        className="rounded-full"
                                        disabled={sending}
                                        onClick={() => invite(person)}
                                    >
                                        <UserPlus className="h-4 w-4" />
                                        Invite
                                    </Button>
                                }
                            />
                        ))
                    )}
                </section>
            </DialogContent>
        </Dialog>
    );
}

function Row({ person, meta, action }) {
    const name = playerName(person);
    return (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-2.5">
            <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={person?.profile_picture_url} alt={name} />
                    <AvatarFallback>{playerInitials(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                    {meta ?? (
                        <span className="truncate text-xs text-muted-foreground">
                            {[person?.district, person?.division].filter(Boolean).join(", ")}
                        </span>
                    )}
                </div>
            </div>
            <div className="shrink-0">{action}</div>
        </div>
    );
}
