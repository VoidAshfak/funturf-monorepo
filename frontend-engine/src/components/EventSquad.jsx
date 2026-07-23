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

    // Build the roster as full rows carrying role + join date + user, so each
    // squad item can show a role badge, when they joined, and profile stats.
    // Only APPROVED rows count as squad members.
    const approvedRows = participants.filter((p) => p.status === "approved");

    // Organizer first, synthesized as an "organizer" row — they have no
    // event_participants row of their own. joined_at falls back to when the match
    // was created (not always present), so the badge stays graceful without it.
    const roster = [];
    if (organizer?.id) {
        roster.push({
            user_id: organizer.id,
            users: organizer,
            role: "organizer",
            joined_at: event.created_at ?? null,
            status: "approved",
        });
    }
    approvedRows.forEach((p) => {
        const uid = p.user_id ?? p.users?.id;
        // Guard against a stray organizer participant row (avoid a duplicate).
        if (organizer?.id && uid === organizer.id) return;
        roster.push(p);
    });

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

            {/* Roster scrolls once it outgrows ~6-7 rows, so a big squad doesn't
                stretch the card down the page. Thin scrollbar, room for it on the
                right so rows don't jump under it. */}
            <div className="max-h-96 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin]">
                {roster.length > 0 ? (
                    roster.map((row, i) => (
                        <PlayerItem key={row.user_id ?? row.users?.id ?? i} participant={row} />
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
