"use client";

import PlayerItem from "@/components/PlayerItem";
import { useGetEventByIdQuery } from "@/store/api/apiSlice";
import { Users } from "lucide-react";

// The match roster, LIVE. Reads the event via RTK Query (seeded by the server's
// initial fetch) so it updates the instant EventRealtime invalidates the cache on
// a join/accept/leave — no refresh. Only APPROVED players are shown; the organizer
// is always included even if they have no participant row.
export default function EventSquad({ eventId, initialEvent }) {
    const { data } = useGetEventByIdQuery(eventId, { skip: !eventId });
    const event = data ?? initialEvent ?? {};

    const organizer = event.organizer;
    const participants = event.participants || [];

    // Approved squad members' user objects (PlayerItem wants the user, not the row).
    const approvedUsers = participants
        .filter((p) => p.status === "approved")
        .map((p) => p.users || { id: p.user_id });

    // Ensure the organizer shows even if they aren't in event_participants.
    const roster = [...approvedUsers];
    if (organizer?.id && !roster.some((u) => u?.id === organizer.id)) {
        roster.unshift(organizer);
    }

    const min = event.min_players ?? 0;
    const cur = event.current_players ?? roster.length;
    const isFull = min > 0 && cur >= min;
    const spotsLeft = Math.max(min - cur, 0);
    const pct = min ? Math.min(Math.round((cur / min) * 100), 100) : 0;

    return (
        <aside className="glass-card h-fit rounded-3xl p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">Squad</h2>
                <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
                    {cur}/{min || "—"}
                </span>
            </div>

            {/* progress */}
            <div className="mb-5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                        className="h-full rounded-full bg-gradient-to-r from-brand to-teal transition-all duration-500"
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                    {isFull
                        ? "This squad is full."
                        : `${spotsLeft} more player${spotsLeft === 1 ? "" : "s"} needed.`}
                </p>
            </div>

            <div className="space-y-1">
                {roster.length > 0 ? (
                    roster.map((u, i) => (
                        <PlayerItem key={u?.id ?? i} participant={u} />
                    ))
                ) : (
                    <p className="rounded-xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                        <Users className="mx-auto mb-2 h-5 w-5" />
                        No players yet. Be the first to join!
                    </p>
                )}
            </div>
        </aside>
    );
}
