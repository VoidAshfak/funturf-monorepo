"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Shield, ShieldPlus, Users, MapPin, Check, X, Crown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    useGetMyTeamsQuery,
    useGetMyTeamInvitesQuery,
    useAcceptTeamInviteMutation,
    useDeclineTeamInviteMutation,
} from "@/store/api/apiSlice";
import EmptyState from "@/components/EmptyState";
import { notifyError } from "@/lib/notify";
import { getApiErrorMessage } from "@/utils/apiError";
import { ROLE_LABEL, teamInitials } from "@/utils/teams";

/**
 * "My Teams" — the caller's persistent squads plus any invites waiting on them.
 *
 * Client-rendered on purpose: every /teams endpoint requires a Bearer token, and
 * the token lives in the NextAuth session synced into `authSlice` (see AuthSync),
 * which the server fetchers in `utils/getData.js` don't carry. Same shape as the
 * turfmates page, which solved the same problem.
 */
export default function TeamsPage() {
    const { data: session, status } = useSession();

    const skip = !session;
    const teamsQ = useGetMyTeamsQuery(undefined, { skip });
    const invitesQ = useGetMyTeamInvitesQuery(undefined, { skip });

    if (status === "loading") return null;

    if (!session) {
        return (
            <div className="mx-auto max-w-3xl px-4 pb-16 pt-28 md:px-8">
                <EmptyState
                    Icon={Shield}
                    title="Sign in to see your teams"
                    description="Build a squad that sticks together — one roster, every match."
                />
                <div className="mt-6 flex justify-center">
                    <Button asChild className="green-glow rounded-full">
                        <Link href="/login">Log in</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const teams = teamsQ.data?.teams ?? [];
    const invites = invitesQ.data?.invites ?? [];

    return (
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 md:px-8 md:pt-24">
            {/* header */}
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <span className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                        <Shield className="h-3.5 w-3.5 text-primary" />
                        Your squads
                    </span>
                    <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground md:text-5xl">
                        Teams
                    </h1>
                    <p className="mt-2 max-w-md text-muted-foreground">
                        A team that stays together — one roster, roles and positions, ready for every match.
                    </p>
                </div>
                <Button asChild className="green-glow rounded-full">
                    <Link href="/teams/create">
                        <ShieldPlus className="h-4 w-4" />
                        Create a team
                    </Link>
                </Button>
            </div>

            <Tabs defaultValue="teams">
                <TabsList className="mb-6">
                    <TabsTrigger value="teams">
                        My Teams
                        <Count n={teams.length} />
                    </TabsTrigger>
                    <TabsTrigger value="invites">
                        Invites
                        <Count n={invites.length} highlight={invites.length > 0} />
                    </TabsTrigger>
                </TabsList>

                {/* My teams */}
                <TabsContent value="teams">
                    {teamsQ.isLoading ? (
                        <ListSkeleton />
                    ) : teams.length === 0 ? (
                        <EmptyState
                            Icon={Shield}
                            title="No teams yet"
                            description="Create one and start inviting the players you always call anyway."
                        >
                            <Button asChild className="green-glow rounded-full">
                                <Link href="/teams/create">Create a team</Link>
                            </Button>
                        </EmptyState>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {teams.map((team) => (
                                <TeamCard key={team.id} team={team} />
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Incoming invites */}
                <TabsContent value="invites">
                    {invitesQ.isLoading ? (
                        <ListSkeleton />
                    ) : invites.length === 0 ? (
                        <EmptyState
                            Icon={Users}
                            title="No invites right now"
                            description="When a captain wants you on their squad, it shows up here."
                        />
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {invites.map((invite) => (
                                <InviteCard key={invite.inviteId} invite={invite} />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function Count({ n, highlight }) {
    if (!n) return null;
    return (
        <span
            className={`ml-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold ${
                highlight ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
        >
            {n}
        </span>
    );
}

function CardShell({ children, highlight }) {
    return (
        <div
            className={`glass-card flex items-center justify-between gap-3 rounded-2xl border border-border p-3 ${
                highlight ? "ring-1 ring-primary/40" : ""
            }`}
        >
            {children}
        </div>
    );
}

// Crest + name + sport/area, linking through to the team page.
function TeamHeader({ team, sub }) {
    return (
        <Link href={`/teams/${team.id}`} className="flex min-w-0 items-center gap-3">
            <Avatar className="h-11 w-11 rounded-xl">
                <AvatarImage src={team.crest_url} alt={team.name} className="rounded-xl" />
                <AvatarFallback className="rounded-xl bg-primary/10 font-bold text-primary">
                    {teamInitials(team.name)}
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{team.name}</p>
                {sub}
            </div>
        </Link>
    );
}

function TeamMeta({ team }) {
    return (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {team.sports?.name && <span className="capitalize">{team.sports.name}</span>}
            {team.home_area && (
                <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-primary" />
                    {team.home_area}
                </span>
            )}
            {typeof team.member_count === "number" && (
                <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {team.member_count}
                </span>
            )}
        </span>
    );
}

function TeamCard({ team }) {
    const isCaptain = team.my_role === "captain";
    return (
        <CardShell highlight={isCaptain}>
            <TeamHeader team={team} sub={<TeamMeta team={team} />} />
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                {isCaptain && <Crown className="h-3 w-3 text-primary" />}
                {ROLE_LABEL[team.my_role] ?? "Member"}
            </span>
        </CardShell>
    );
}

function InviteCard({ invite }) {
    const [accept, { isLoading: accepting }] = useAcceptTeamInviteMutation();
    const [decline, { isLoading: declining }] = useDeclineTeamInviteMutation();

    // Both actions surface their own error toast — an invite can go stale
    // (withdrawn by the captain) between render and click.
    const run = async (fn) => {
        try {
            await fn(invite.inviteId).unwrap();
        } catch (err) {
            notifyError(getApiErrorMessage(err, "That invite is no longer available."));
        }
    };

    return (
        <CardShell highlight>
            <TeamHeader team={invite.team ?? {}} sub={<TeamMeta team={invite.team ?? {}} />} />
            <div className="flex shrink-0 gap-2">
                <Button
                    size="sm"
                    className="green-glow rounded-full"
                    disabled={accepting || declining}
                    onClick={() => run(accept)}
                >
                    <Check className="h-4 w-4" />
                    Join
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={accepting || declining}
                    onClick={() => run(decline)}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </CardShell>
    );
}

function ListSkeleton() {
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[72px] animate-pulse rounded-2xl border border-border bg-card/50" />
            ))}
        </div>
    );
}
