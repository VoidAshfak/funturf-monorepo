import { getUserByUserId } from "@/utils/getData";
import { format } from "date-fns";
import {
    BadgeCheck,
    CalendarDays,
    Mail,
    MapPin,
    MessageCircle,
    Phone,
    UserPlus,
    Users,
} from "lucide-react";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import EmptyState from "./EmptyState";

function age(dob) {
    if (!dob) return null;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return null;
    const diff = Date.now() - d.getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

export default async function ProfileCard({ userId }) {
    const result = await getUserByUserId(userId);

    if (!result.ok) {
        return <EmptyState title="No User Found" />;
    }

    const u = result.data;
    const {
        email,
        username,
        phone,
        first_name,
        last_name,
        date_of_birth,
        profile_picture_url,
        bio,
        user_type,
        email_verified,
        phone_verified,
        created_at,
        sports = [],
        teamsJoined = 0,
        eventsJoined = 0,
        friends = 0,
    } = u;

    const fullName = `${first_name ?? ""} ${last_name ?? ""}`.trim() || "Player";
    const initials = `${first_name?.[0] ?? ""}${last_name?.[0] ?? ""}`.toUpperCase() || "PF";
    const years = age(date_of_birth);

    const stats = [
        { label: "Events", value: eventsJoined },
        { label: "Teams", value: teamsJoined },
        { label: "Friends", value: friends },
    ];

    return (
        <div className="glass-card rounded-3xl p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
                {/* avatar (overlaps banner) */}
                <Avatar className="-mt-24 h-32 w-32 shrink-0 self-center ring-4 ring-card shadow-xl md:-mt-28 md:self-start md:h-36 md:w-36">
                    <AvatarImage src={profile_picture_url} alt={fullName} />
                    <AvatarFallback className="bg-gradient-to-br from-brand to-teal text-2xl font-extrabold text-primary-foreground">
                        {initials}
                    </AvatarFallback>
                </Avatar>

                {/* identity */}
                <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="text-center md:text-left">
                            <div className="flex items-center justify-center gap-2 md:justify-start">
                                <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                                    {fullName}
                                </h1>
                                {user_type && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold capitalize text-primary">
                                        {user_type}
                                    </span>
                                )}
                            </div>
                            <p className="mt-0.5 font-semibold text-muted-foreground">@{username}</p>

                            {/* meta line */}
                            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground md:justify-start">
                                {years != null && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <CalendarDays className="h-3.5 w-3.5" /> {years} yrs
                                    </span>
                                )}
                                {created_at && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5" />
                                        Joined {format(new Date(created_at), "MMM yyyy")}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* actions */}
                        <div className="flex shrink-0 items-center justify-center gap-2">
                            <Button className="green-glow rounded-full">
                                <UserPlus className="h-4 w-4" />
                                Connect
                            </Button>
                            <Button variant="outline" className="rounded-full">
                                <MessageCircle className="h-4 w-4" />
                                Message
                            </Button>
                        </div>
                    </div>

                    {/* sports */}
                    {sports.length > 0 && (
                        <div className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
                            {sports.map((sport) => (
                                <span
                                    key={sport}
                                    className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize text-foreground"
                                >
                                    <Image
                                        src={`/assets/icons/${String(sport).toLowerCase()}.png`}
                                        alt={sport}
                                        width={14}
                                        height={14}
                                    />
                                    {sport}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* stats */}
                    <div className="mt-5 grid grid-cols-3 gap-3">
                        {stats.map((s) => (
                            <div
                                key={s.label}
                                className="glass-neutral flex flex-col items-center rounded-2xl border border-border/60 py-3"
                            >
                                <p className="text-xl font-extrabold text-foreground">{s.value}</p>
                                <p className="text-xs text-muted-foreground">{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* bio */}
            {bio && (
                <p className="mt-6 border-t border-border pt-5 text-center text-sm leading-relaxed text-foreground/90 md:text-left">
                    {bio}
                </p>
            )}

            {/* contact row */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm md:justify-start">
                {email && (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4 text-primary" />
                        {email}
                        {email_verified && <BadgeCheck className="h-4 w-4 text-primary" />}
                    </span>
                )}
                {phone && (
                    <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4 text-primary" />
                        {phone}
                        {phone_verified && <BadgeCheck className="h-4 w-4 text-primary" />}
                    </span>
                )}
            </div>
        </div>
    );
}
