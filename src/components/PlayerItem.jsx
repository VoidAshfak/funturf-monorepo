import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { users } from "@/lib/users";
import Link from "next/link";

// Accepts a participant in any of the shapes the data can take:
//  - a raw user id string (mock data)            -> looked up in lib/users
//  - an object like `organizer` (real API)       -> first_name/last_name/...
//  - a wrapper object `{ user: {...} }`          -> unwrapped
function normalize(participant) {
    if (!participant) return null;

    if (typeof participant === "string") {
        const u = users.find((x) => x._id === participant);
        return {
            id: participant,
            name: u?.fullName ?? "Player",
            avatar: u?.profilePicture ?? null,
            role: u?.role ?? "",
        };
    }

    const user = participant.user ?? participant;
    const name =
        [user.first_name, user.last_name].filter(Boolean).join(" ") ||
        user.fullName ||
        user.name ||
        "Player";

    return {
        id: user.id ?? participant.user_id ?? participant.id ?? null,
        name,
        avatar: user.profile_picture_url ?? user.profilePicture ?? user.avatar ?? null,
        role: user.role ?? "",
    };
}

export default function PlayerItem({ participant, userId }) {
    const player = normalize(participant ?? userId);
    if (!player) return null;

    const initials = player.name.slice(0, 2).toUpperCase();

    const body = (
        <>
            <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                <AvatarImage src={player.avatar || undefined} alt={player.name} />
                <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{player.name}</p>
                {player.role && (
                    <p className="truncate text-sm text-muted-foreground">{player.role}</p>
                )}
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
