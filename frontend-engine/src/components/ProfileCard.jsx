import { getUserByUserId } from "@/utils/getData";
import { flattenSports } from "@/utils/utility-functions";
import { format } from "date-fns";
import {
    Award,
    BadgeCheck,
    CalendarDays,
    Footprints,
    Gauge,
    MapPin,
    Mail,
    Phone,
    Ruler,
    Shirt,
    Star,
    Timer,
    Trophy,
    User2,
    Weight,
} from "lucide-react";
import SportIcon from "./icons/SportIcon";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import ConnectButton from "./ConnectButton";
import MessageButton from "./MessageButton";
import EmptyState from "./EmptyState";
import EditProfileDialog from "./EditProfileDialog";
import ProfileAvatarEditor from "./ProfileAvatarEditor";
import ProfileCompletionCard from "./ProfileCompletionCard";

function age(dob) {
    if (!dob) return null;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return null;
    const diff = Date.now() - d.getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

// `isOwner` is decided by the page from the server session. It only controls
// which affordances render — the API independently enforces that a user can
// only ever edit themselves (PATCH /users/me takes its target from the JWT).
export default async function ProfileCard({ userId, isOwner = false }) {
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
        gender,
        division,
        district,
        profile_picture_url,
        bio,
        user_type,
        email_verified,
        phone_verified,
        created_at,
        rating,
        sports = [],
        eventsJoined = 0,
        gamesOrganized = 0,
        friends = 0,
        player_profile = null,
    } = u;

    const fullName = `${first_name ?? ""} ${last_name ?? ""}`.trim() || "Player";
    const initials = `${first_name?.[0] ?? ""}${last_name?.[0] ?? ""}`.toUpperCase() || "PF";
    const years = age(date_of_birth);
    const location = [district, division].filter(Boolean).join(", ");

    const stats = [
        { label: "Events", value: eventsJoined },
        { label: "Organized", value: gamesOrganized },
        { label: "Friends", value: friends },
    ];

    // Sporting profile attributes — only the ones actually filled in are shown.
    const positions = Array.isArray(player_profile?.preferred_positions)
        ? player_profile.preferred_positions
        : [];
    const attrs = player_profile
        ? [
              { icon: Trophy, label: "Skill", value: player_profile.skill_level },
              {
                  icon: CalendarDays,
                  label: "Experience",
                  value:
                      player_profile.years_of_experience != null
                          ? `${player_profile.years_of_experience} yr${player_profile.years_of_experience === 1 ? "" : "s"}`
                          : null,
              },
              { icon: Footprints, label: "Preferred foot", value: player_profile.preferred_foot },
              {
                  icon: Shirt,
                  label: "Jersey",
                  value: player_profile.jersey_number != null ? `#${player_profile.jersey_number}` : null,
              },
              {
                  icon: Ruler,
                  label: "Height",
                  value: player_profile.height_cm ? `${player_profile.height_cm} cm` : null,
              },
              {
                  icon: Weight,
                  label: "Weight",
                  value: player_profile.weight_kg ? `${player_profile.weight_kg} kg` : null,
              },
              { icon: Timer, label: "Plays", value: player_profile.preferred_play_time },
              {
                  icon: MapPin,
                  label: "Max travel",
                  value: player_profile.max_travel_distance_km
                      ? `${player_profile.max_travel_distance_km} km`
                      : null,
              },
              {
                  icon: Gauge,
                  label: "Reliability",
                  value:
                      player_profile.reliability_score != null
                          ? `${player_profile.reliability_score}%`
                          : null,
              },
              {
                  icon: Trophy,
                  label: "Games played",
                  value: player_profile.total_games_played ?? null,
              },
          ].filter((a) => a.value != null && a.value !== "")
        : [];

    return (
        <>
        <div className="glass-card rounded-3xl p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
                {/* avatar (overlaps banner) — `relative` so the owner's camera
                    badge can anchor to it */}
                <div className="relative -mt-24 shrink-0 self-center md:-mt-28 md:self-start">
                    <Avatar className="h-32 w-32 ring-4 ring-card shadow-xl md:h-36 md:w-36">
                        <AvatarImage src={profile_picture_url} alt={fullName} />
                        <AvatarFallback className="bg-gradient-to-br from-brand to-teal text-2xl font-extrabold text-primary-foreground">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    {isOwner && <ProfileAvatarEditor />}
                </div>

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
                                {rating != null && rating > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/15 px-2.5 py-0.5 text-xs font-bold text-yellow-600 dark:text-yellow-400">
                                        <Star className="h-3.5 w-3.5 fill-current" />
                                        {Number(rating).toFixed(1)}
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
                                {gender && (
                                    <span className="inline-flex items-center gap-1.5 capitalize">
                                        <User2 className="h-3.5 w-3.5" /> {gender}
                                    </span>
                                )}
                                {location && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5" /> {location}
                                    </span>
                                )}
                                {created_at && (
                                    <span className="inline-flex items-center gap-1.5">
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        Joined {format(new Date(created_at), "MMM yyyy")}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* actions — you edit your own profile; you connect to and
                            message everyone else's */}
                        <div className="flex shrink-0 items-center justify-center gap-2">
                            {isOwner ? (
                                <EditProfileDialog user={u} />
                            ) : (
                                <>
                                    <ConnectButton userId={userId} />
                                    <MessageButton
                                        userId={userId}
                                        name={fullName}
                                        avatar={profile_picture_url}
                                    />
                                </>
                            )}
                        </div>
                    </div>

                    {/* sports */}
                    {flattenSports(sports).length > 0 && (
                        <div className="mt-4 flex flex-wrap justify-center gap-2 md:justify-start">
                            {flattenSports(sports).map((sport) => (
                                <span
                                    key={sport}
                                    className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize text-foreground"
                                >
                                    <SportIcon sport={sport} className="h-3.5 w-3.5 text-primary" />
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

            {/* sporting profile — full attribute grid + positions + achievements */}
            {player_profile && (attrs.length > 0 || positions.length > 0 || player_profile.achievements) && (
                <div className="mt-6 border-t border-border pt-5">
                    <h3 className="mb-3 text-sm font-bold text-foreground">Player profile</h3>

                    {positions.length > 0 && (
                        <div className="mb-4 flex flex-wrap justify-center gap-2 md:justify-start">
                            {positions.map((p) => (
                                <span
                                    key={p}
                                    className="glass-chip inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize text-foreground"
                                >
                                    <User2 className="h-3.5 w-3.5 text-primary" />
                                    {String(p).replace(/_/g, " ")}
                                </span>
                            ))}
                        </div>
                    )}

                    {attrs.length > 0 && (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                            {attrs.map((a) => (
                                <div
                                    key={a.label}
                                    className="glass-neutral flex flex-col gap-1 rounded-2xl border border-border/60 p-3"
                                >
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                                        <a.icon className="h-3.5 w-3.5 text-primary" /> {a.label}
                                    </span>
                                    <span className="text-sm font-bold capitalize text-foreground">
                                        {a.value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {player_profile.achievements && (
                        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-primary/10 p-4 text-sm text-foreground/90">
                            <Award className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <p className="leading-relaxed">{player_profile.achievements}</p>
                        </div>
                    )}
                </div>
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

        {/* "Finish your profile" nudge — own profile only, and it hides itself
            once the profile is complete. */}
        {isOwner && <ProfileCompletionCard user={u} />}
        </>
    );
}
