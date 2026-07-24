"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Search, Sparkles, Target, Zap } from "lucide-react";
import { Button } from "./ui/button";
import EditProfileDialog from "./EditProfileDialog";

// Which tab of the edit dialog each checklist field lives on, so "Add this"
// opens straight onto the right form instead of dumping the user at the top.
// Keys mirror the backend checklist in `utils/profileService.js`.
const PLAYER_TAB_FIELDS = new Set([
    "sports_played", "skill_level", "preferred_positions", "preferred_play_time",
    "max_travel_distance_km", "years_of_experience", "preferred_foot",
    "jersey_number", "height_cm", "weight_kg", "achievements",
]);

// What a complete profile actually buys you. Deliberately concrete — a vague
// "unlock more features" nudge is noise; these are the real ways the platform
// uses profile data today.
// What a complete profile actually buys you. Every line here is backed by real
// behaviour — the ranking in `GET /users/scout` and the turfmate recommendation
// score both use the same completeness figure shown on this card.
const BENEFITS = [
    { icon: Search, text: "Captains scout by sport, position and skill — set none and their search can't find you at all." },
    { icon: Target, text: "Complete profiles rank first in scouting results and turfmate suggestions." },
    { icon: Zap, text: "Organizers approve join requests faster when they can see who you are." },
];

/** Colour the ring by how far along the player is. */
const ringColor = (percent) => {
    if (percent >= 80) return "text-primary";
    if (percent >= 50) return "text-yellow-500";
    return "text-orange-500";
};

/**
 * "Finish your profile" card — OWN PROFILE ONLY.
 *
 * Shows the completion score the API computed (never recomputed here, so the
 * checklist can't drift from what the server counts), what's still missing, and
 * why it's worth filling in. Each missing row opens the edit dialog on the tab
 * that holds it.
 *
 * Renders nothing at 100% — a finished profile shouldn't keep nagging.
 */
export default function ProfileCompletionCard({ user }) {
    const [showAll, setShowAll] = useState(false);
    const completion = user?.profile_completion;

    if (!completion || completion.percent >= 100) return null;

    const { percent, missing = [], filled_count, total_count } = completion;

    // Highest-weight gaps first — the fields that do the most for discoverability.
    const ranked = [...missing].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
    const visible = showAll ? ranked : ranked.slice(0, 4);

    // SVG ring geometry.
    const RADIUS = 26;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

    return (
        <div className="glass-card mt-6 rounded-3xl p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                {/* progress ring */}
                <div className="relative mx-auto h-20 w-20 shrink-0 sm:mx-0">
                    <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
                        <circle
                            cx="32" cy="32" r={RADIUS}
                            className="stroke-border"
                            strokeWidth="6"
                            fill="none"
                        />
                        <circle
                            cx="32" cy="32" r={RADIUS}
                            className={`${ringColor(percent)} transition-[stroke-dashoffset] duration-700`}
                            stroke="currentColor"
                            strokeWidth="6"
                            strokeLinecap="round"
                            fill="none"
                            strokeDasharray={CIRCUMFERENCE}
                            strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
                        />
                    </svg>
                    <span className="absolute inset-0 grid place-items-center text-lg font-extrabold text-foreground">
                        {percent}%
                    </span>
                </div>

                <div className="min-w-0 flex-1">
                    <h3 className="flex items-center gap-2 text-lg font-extrabold text-foreground">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Finish your profile
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {filled_count} of {total_count} details added. Players with a full
                        profile get picked for matches far more often.
                    </p>

                    {/* why it's worth doing */}
                    <ul className="mt-4 space-y-2">
                        {BENEFITS.map((b) => (
                            <li key={b.text} className="flex items-start gap-2 text-sm text-foreground/90">
                                <b.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                <span>{b.text}</span>
                            </li>
                        ))}
                    </ul>

                    {/* what's left */}
                    <div className="mt-5 space-y-2">
                        {visible.map((item) => (
                            <EditProfileDialog
                                key={item.key}
                                user={user}
                                defaultTab={PLAYER_TAB_FIELDS.has(item.key) ? "player" : "basics"}
                                trigger={
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted"
                                    >
                                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-foreground">
                                                {item.label}
                                            </span>
                                            <span className="block truncate text-xs text-muted-foreground">
                                                {item.hint}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-xs font-bold text-primary">Add</span>
                                    </button>
                                }
                            />
                        ))}

                        {ranked.length > visible.length && (
                            <button
                                type="button"
                                onClick={() => setShowAll(true)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                                Show {ranked.length - visible.length} more
                                <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="mt-5">
                        <EditProfileDialog
                            user={user}
                            trigger={
                                <Button className="green-glow gap-2 rounded-full">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Complete my profile
                                </Button>
                            }
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
