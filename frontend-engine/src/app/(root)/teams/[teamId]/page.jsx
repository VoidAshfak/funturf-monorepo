"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    ArrowLeft,
    CalendarPlus,
    Crown,
    MapPin,
    Shield,
    Trash2,
    Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import EventCard from "@/components/EventCard";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import { notifyError } from "@/lib/notify";
import { getApiErrorMessage } from "@/utils/apiError";
import { playerInitials, playerName, teamInitials } from "@/utils/teams";
import {
    useDeleteTeamMutation,
    useGetTeamByIdQuery,
    useGetTeamEventsQuery,
} from "@/store/api/apiSlice";
import TeamRoster from "./_components/TeamRoster";

/**
 * Team detail: identity, roster, and the matches this team has organized.
 *
 * Client-rendered because every /teams endpoint is Bearer-authenticated and the
 * token lives in the NextAuth session synced into `authSlice` — the server
 * fetchers in utils/getData.js don't carry it. Same call the turfmates page makes.
 */
export default function TeamPage({ params }) {
    // Next 15: `params` is a promise in client components.
    const { teamId } = use(params);
    const router = useRouter();
    const { status } = useSession();

    const { data: team, isLoading, error } = useGetTeamByIdQuery(teamId, { skip: !teamId });
    const { data: eventsData } = useGetTeamEventsQuery({ teamId }, { skip: !teamId });
    const [deleteTeam] = useDeleteTeamMutation();

    const [confirmDisband, setConfirmDisband] = useState(false);

    if (status === "loading" || isLoading) return null;

    if (error || !team?.id) {
        return (
            <div className="mx-auto max-w-3xl px-4 pb-16 pt-28 md:px-8">
                <EmptyState
                    Icon={Shield}
                    title="Team not found"
                    description="It may have been disbanded, or the link is wrong."
                >
                    <Button asChild variant="outline" className="rounded-full">
                        <Link href="/teams">Back to teams</Link>
                    </Button>
                </EmptyState>
            </div>
        );
    }

    const isCaptain = team.my_role === "captain";
    const events = eventsData?.events ?? [];

    return (
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:px-8 md:pt-24">
            <Link
                href="/teams"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" /> Back to teams
            </Link>

            {/* ---- identity ---- */}
            <header className="glass-card mt-4 mb-8 rounded-3xl p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                        <Avatar className="h-16 w-16 rounded-2xl">
                            <AvatarImage src={team.crest_url} alt={team.name} className="rounded-2xl" />
                            <AvatarFallback className="rounded-2xl bg-primary/10 text-xl font-bold text-primary">
                                {teamInitials(team.name)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <h1 className="truncate text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                                {team.name}
                            </h1>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                {team.sports?.name && <span className="capitalize">{team.sports.name}</span>}
                                {team.home_area && (
                                    <span className="flex items-center gap-1">
                                        <MapPin className="h-3.5 w-3.5 text-primary" />
                                        {team.home_area}
                                    </span>
                                )}
                                <span className="flex items-center gap-1">
                                    <Users className="h-3.5 w-3.5" />
                                    {team.member_count ?? team.members?.length ?? 0} players
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                        {/* Anyone on the roster can organize a match for the team. */}
                        {team.my_role && (
                            <Button asChild size="sm" className="green-glow rounded-full">
                                <Link href="/events/create">
                                    <CalendarPlus className="h-4 w-4" />
                                    Organize a match
                                </Link>
                            </Button>
                        )}
                        {/* Captain-only — the backend rejects it for anyone else regardless. */}
                        {isCaptain && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="rounded-full text-muted-foreground hover:text-destructive"
                                onClick={() => setConfirmDisband(true)}
                            >
                                <Trash2 className="h-4 w-4" />
                                Disband
                            </Button>
                        )}
                    </div>
                </div>

                {team.description && (
                    <p className="mt-4 text-sm text-muted-foreground">{team.description}</p>
                )}

                {team.captain && (
                    <Link
                        href={`/profile/${team.captain.id}`}
                        className="mt-4 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
                    >
                        <Crown className="h-3.5 w-3.5 text-primary" />
                        <Avatar className="h-5 w-5">
                            <AvatarImage
                                src={team.captain.profile_picture_url}
                                alt={playerName(team.captain)}
                            />
                            <AvatarFallback className="text-[9px]">
                                {playerInitials(playerName(team.captain))}
                            </AvatarFallback>
                        </Avatar>
                        {playerName(team.captain)}
                    </Link>
                )}
            </header>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                {/* ---- roster ---- */}
                <TeamRoster teamId={teamId} initialTeam={team} />

                {/* ---- team matches ---- */}
                <section className="glass-card h-fit rounded-3xl p-5 md:p-6">
                    <h2 className="mb-5 text-lg font-bold text-foreground">Team matches</h2>
                    {events.length === 0 ? (
                        <p className="rounded-xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                            <CalendarPlus className="mx-auto mb-2 h-5 w-5" />
                            No matches organized under this team yet.
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {events.map((event) => (
                                <Link key={event.id} href={`/events/${event.id}`}>
                                    <EventCard event={event} />
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <ConfirmDialog
                open={confirmDisband}
                onOpenChange={setConfirmDisband}
                Icon={Trash2}
                title={`Disband ${team.name}?`}
                description="The team is retired and drops off everyone's list. Matches it organized stay in your history."
                confirmLabel="Disband"
                cancelLabel="Keep the team"
                onConfirm={async () => {
                    try {
                        await deleteTeam(teamId).unwrap();
                        router.push("/teams");
                    } catch (err) {
                        notifyError(getApiErrorMessage(err, "Could not disband the team."));
                        throw err; // keep the modal open so the toast is readable
                    }
                }}
            />
        </div>
    );
}
