"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetSportsCatalogueQuery, useGetTeamByIdQuery } from "@/store/api/apiSlice";
import { CAN_INVITE_ROLES } from "@/utils/teams";
import TeamMemberRow from "./TeamMemberRow";
import TeamInviteDialog from "./TeamInviteDialog";

/**
 * The team's roster, LIVE.
 *
 * Reads the team through RTK Query (seeded by the page's initial fetch) exactly
 * like EventSquad reads its match, so a role change, a removal or an accepted
 * invite re-renders the list the moment the mutation invalidates the cache — no
 * refresh.
 *
 * Only ACTIVE members come back from the API; people who left or were removed
 * stay in the database for history but never appear here.
 */
export default function TeamRoster({ teamId, initialTeam }) {
    const { data: session } = useSession();
    const { data } = useGetTeamByIdQuery(teamId, { skip: !teamId });
    const team = data ?? initialTeam ?? {};

    const [inviteOpen, setInviteOpen] = useState(false);

    // Positions for THIS team's sport — the only ones the backend will accept.
    const { data: sports = [] } = useGetSportsCatalogueQuery();
    const positions = sports.find((s) => s.id === team.sport_id)?.sport_positions ?? [];

    const members = team.members ?? [];
    const myId = session?.user?.id;
    const isCaptain = team.my_role === "captain";
    const canInvite = CAN_INVITE_ROLES.includes(team.my_role);

    return (
        <section className="glass-card rounded-3xl p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground">Roster</h2>
                    <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
                        {members.length}
                    </span>
                </div>
                {/* Recruiting is captain/co-captain only — and re-checked server-side. */}
                {canInvite && (
                    <Button size="sm" className="green-glow rounded-full" onClick={() => setInviteOpen(true)}>
                        <UserPlus className="h-4 w-4" />
                        Invite
                    </Button>
                )}
            </div>

            <div className="space-y-2">
                {members.length > 0 ? (
                    members.map((member) => (
                        <TeamMemberRow
                            key={member.membershipId}
                            member={member}
                            teamId={teamId}
                            isCaptain={isCaptain}
                            isSelf={member.user?.id === myId}
                            positions={positions}
                        />
                    ))
                ) : (
                    <p className="rounded-xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                        <Users className="mx-auto mb-2 h-5 w-5" />
                        Nobody on the roster yet.
                    </p>
                )}
            </div>

            {canInvite && (
                <TeamInviteDialog
                    open={inviteOpen}
                    onOpenChange={setInviteOpen}
                    teamId={teamId}
                    memberIds={members.map((m) => m.user?.id).filter(Boolean)}
                />
            )}
        </section>
    );
}
