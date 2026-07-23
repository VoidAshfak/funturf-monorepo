import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { users } from "@/lib/users";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Crown, Shield, Star, Trophy } from "lucide-react";
import Link from "next/link";

// Role badge shown next to a squad member's name. Only organiser/admin get one;
// a plain player shows nothing (keeps the list quiet).
const ROLE_BADGE = {
    organizer: { label: "Organizer", Icon: Crown, className: "border-primary/40 bg-primary/10 text-primary" },
    co_organizer: { label: "Admin", Icon: Shield, className: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

// Pretty label for a skill_level enum value ("intermediate" -> "Intermediate").
function titleCase(v) {
    return typeof v === "string" && v
        ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, " ")
        : null;
}

// Accepts a participant in any of the shapes the data can take:
//  - a raw user id string (mock data)                    -> looked up in lib/users
//  - a roster ROW `{ role, joined_at, users:{...} }`     -> real API (squad list)
//  - a plain user object (organizer / wrapper)           -> unwrapped
function normalize(participant) {
    if (!participant) return null;

    if (typeof participant === "string") {
        const u = users.find((x) => x._id === participant);
        return {
            id: participant,
            name: u?.fullName ?? "Player",
            avatar: u?.profilePicture ?? null,
            role: u?.role ?? "player",
            joinedAt: null,
            location: null,
            skillLevel: null,
            gamesPlayed: null,
        };
    }

    // The row wraps the user under `users` (API) or `user` (legacy); a bare user
    // object is its own user.
    const user = participant.users ?? participant.user ?? participant;
    // Player stats live either flattened on the user (organizer DTO) or under a
    // player_profiles array (raw participant row) — read whichever is present.
    const profile = Array.isArray(user.player_profiles)
        ? user.player_profiles[0]
        : user.player_profiles;

    const name =
        [user.first_name, user.last_name].filter(Boolean).join(" ") ||
        user.fullName ||
        user.name ||
        "Player";

    return {
        id: user.id ?? participant.user_id ?? participant.id ?? null,
        name,
        avatar: user.profile_picture_url ?? user.profilePicture ?? user.avatar ?? null,
        // Role comes from the participant ROW, not the user (a user's global
        // user.role is unrelated to their role in THIS match).
        role: participant.role ?? "player",
        joinedAt: participant.joined_at ?? null,
        location: [user.district, user.division].filter(Boolean).join(", ") || null,
        skillLevel: titleCase(user.skill_level ?? profile?.skill_level ?? null),
        gamesPlayed: user.total_games_played ?? profile?.total_games_played ?? null,
    };
}

export default function PlayerItem({ participant, userId }) {
    const player = normalize(participant ?? userId);
    if (!player) return null;

    const initials = player.name.slice(0, 2).toUpperCase();
    const badge = ROLE_BADGE[player.role] ?? null;

    // Compact meta chips: skill level, games played, home area. Only render the
    // ones we actually have data for.
    const chips = [
        player.skillLevel && { Icon: Star, text: player.skillLevel },
        player.gamesPlayed != null && {
            Icon: Trophy,
            text: `${player.gamesPlayed} game${player.gamesPlayed === 1 ? "" : "s"}`,
        },
    ].filter(Boolean);

    const body = (
        <>
            <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/20">
                <AvatarImage src={player.avatar || undefined} alt={player.name} />
                <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                {/* name + role badge */}
                <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-foreground">{player.name}</p>
                    {badge && (
                        <span
                            className={cn(
                                "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-bold",
                                badge.className
                            )}
                        >
                            <badge.Icon className="h-3 w-3" />
                            {badge.label}
                        </span>
                    )}
                </div>

                {/* profile chips: skill + games played */}
                {chips.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
                        {chips.map((c, i) => (
                            <span key={i} className="inline-flex items-center gap-1">
                                <c.Icon className="h-3 w-3 text-primary" />
                                {c.text}
                            </span>
                        ))}
                    </div>
                )}

                {/* home area + join date */}
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                    {player.location && <span className="truncate">{player.location}</span>}
                    {player.location && player.joinedAt && <span>·</span>}
                    {player.joinedAt && (
                        <span>Joined {format(new Date(player.joinedAt), "d MMM")}</span>
                    )}
                </div>
            </div>
        </>
    );

    const className =
        "flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-accent";

    return player.id ? (
        <Link href={`/profile/${player.id}`} className={className}>
            {body}
        </Link>
    ) : (
        <div className={className}>{body}</div>
    );
}
