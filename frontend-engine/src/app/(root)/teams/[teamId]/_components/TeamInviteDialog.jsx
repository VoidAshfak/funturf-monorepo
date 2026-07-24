"use client";

import { useMemo, useState } from "react";
import { Clock, Search, UserPlus, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    useCancelTeamInviteMutation,
    useGetTeamInvitesQuery,
    useGetTurfmatesQuery,
    useScoutPlayersQuery,
    useSendTeamInviteMutation,
} from "@/store/api/apiSlice";
import { notifyError, notifySuccess } from "@/lib/notify";
import { getApiErrorMessage } from "@/utils/apiError";
import { playerInitials, playerName } from "@/utils/teams";
import { PLAYER_POSITIONS, SKILL_LEVELS, SPORTS } from "@/utils/constants";

// Radix forbids an empty-string <SelectItem> value, so "any" rides a sentinel
// that is stripped before the query goes out.
const ANY = "__any__";

/**
 * Recruit players onto the team, from two pools:
 *
 *   Turfmates — the people you already play with. Still the default, because
 *               they're who a captain usually wants and there's zero friction.
 *   Scout     — everyone else, searched by sport / position / skill / name via
 *               `GET /users/scout`. Ranked server-side with profile completeness
 *               as the dominant term, so the players a captain can actually size
 *               up come first.
 *
 * Anyone already on the roster or already invited is filtered out client-side in
 * both pools; the backend enforces the same rules (`ALREADY_TEAM_MEMBER` /
 * `TEAM_INVITE_ALREADY_EXISTS`) regardless.
 *
 * Only rendered for a captain or co-captain — see TeamRoster.
 */
export default function TeamInviteDialog({ open, onOpenChange, teamId, memberIds = [] }) {
    const [tab, setTab] = useState("turfmates");
    const [query, setQuery] = useState("");

    // Scout filters — kept separate from `query` so switching tabs doesn't drag
    // a turfmate name search into a platform-wide one.
    const [scoutQuery, setScoutQuery] = useState("");
    const [sport, setSport] = useState(ANY);
    const [position, setPosition] = useState(ANY);
    const [skill, setSkill] = useState(ANY);

    const turfmatesQ = useGetTurfmatesQuery(undefined, { skip: !open });
    const invitesQ = useGetTeamInvitesQuery({ teamId }, { skip: !open || !teamId });
    const [sendInvite, { isLoading: sending }] = useSendTeamInviteMutation();
    const [cancelInvite] = useCancelTeamInviteMutation();

    // Only query once the captain has actually narrowed it down — an unfiltered
    // "everyone on the platform" list isn't a useful starting point, and it
    // stops the endpoint being hit on every dialog open.
    const scoutParams = useMemo(() => {
        const params = { limit: 20 };
        if (scoutQuery.trim()) params.q = scoutQuery.trim();
        if (sport !== ANY) params.sport = sport;
        if (position !== ANY) params.position = position;
        if (skill !== ANY) params.skill = skill;
        return params;
    }, [scoutQuery, sport, position, skill]);

    const hasScoutFilter = Object.keys(scoutParams).length > 1;
    const scoutQ = useScoutPlayersQuery(scoutParams, {
        skip: !open || tab !== "scout" || !hasScoutFilter,
    });

    const pending = invitesQ.data?.invites ?? [];
    const pendingIds = useMemo(() => new Set(pending.map((i) => i.user?.id)), [pending]);
    const onRoster = useMemo(() => new Set(memberIds), [memberIds]);

    const candidates = useMemo(() => {
        const term = query.trim().toLowerCase();
        return (turfmatesQ.data?.turfmates ?? [])
            .filter((p) => !onRoster.has(p.id) && !pendingIds.has(p.id))
            .filter((p) => (term ? playerName(p).toLowerCase().includes(term) : true));
    }, [turfmatesQ.data, onRoster, pendingIds, query]);

    const scouted = useMemo(
        () =>
            (scoutQ.data?.players ?? []).filter(
                (p) => !onRoster.has(p.id) && !pendingIds.has(p.id)
            ),
        [scoutQ.data, onRoster, pendingIds]
    );

    const invite = async (player) => {
        try {
            await sendInvite({ teamId, invitedUserId: player.id }).unwrap();
            notifySuccess(`Invite sent to ${playerName(player)}`);
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Could not send that invite."));
        }
    };

    const withdraw = async (inviteId) => {
        try {
            await cancelInvite({ inviteId, teamId }).unwrap();
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Could not withdraw that invite."));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[85vh] min-w-0 overflow-y-auto overflow-x-hidden sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Invite players</DialogTitle>
                    <DialogDescription>
                        Pull in turfmates you already play with, or scout the platform by
                        sport and position. They'll get a notification and decide for
                        themselves.
                    </DialogDescription>
                </DialogHeader>

                {/* Already out — withdrawable until they answer. Shown above the
                    tabs because it applies to both pools. */}
                {pending.length > 0 && (
                    <section className="space-y-2">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            Awaiting a reply
                        </h3>
                        {pending.map((i) => (
                            <Row
                                key={i.inviteId}
                                person={i.user}
                                meta={
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        Pending
                                    </span>
                                }
                                action={
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full"
                                        onClick={() => withdraw(i.inviteId)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                }
                            />
                        ))}
                    </section>
                )}

                <Tabs value={tab} onValueChange={setTab} className="min-w-0">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="turfmates">Your turfmates</TabsTrigger>
                        <TabsTrigger value="scout">Scout players</TabsTrigger>
                    </TabsList>

                    {/* ---------------- Turfmates ---------------- */}
                    <TabsContent value="turfmates" className="min-w-0 space-y-2 py-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search your turfmates"
                                className="pl-9"
                            />
                        </div>

                        {turfmatesQ.isLoading ? (
                            <p className="text-sm text-muted-foreground">Loading…</p>
                        ) : candidates.length === 0 ? (
                            <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                                {query
                                    ? "Nobody matches that search."
                                    : "Everyone you're connected with is already on the team or invited. Try scouting instead."}
                            </p>
                        ) : (
                            candidates.map((person) => (
                                <Row
                                    key={person.id}
                                    person={person}
                                    action={
                                        <InviteButton
                                            disabled={sending}
                                            onClick={() => invite(person)}
                                        />
                                    }
                                />
                            ))
                        )}
                    </TabsContent>

                    {/* ---------------- Scout ---------------- */}
                    <TabsContent value="scout" className="min-w-0 space-y-3 py-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={scoutQuery}
                                onChange={(e) => setScoutQuery(e.target.value)}
                                placeholder="Search players by name"
                                className="pl-9"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <FilterSelect
                                value={sport}
                                onChange={setSport}
                                options={SPORTS}
                                anyLabel="Any sport"
                                capitalize={false}
                            />
                            <FilterSelect
                                value={position}
                                onChange={setPosition}
                                options={PLAYER_POSITIONS}
                                anyLabel="Any position"
                            />
                            <FilterSelect
                                value={skill}
                                onChange={setSkill}
                                options={SKILL_LEVELS}
                                anyLabel="Any skill"
                            />
                        </div>

                        {!hasScoutFilter ? (
                            <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                                Pick a sport, position or skill level — or type a name — to
                                find players.
                            </p>
                        ) : scoutQ.isFetching ? (
                            <p className="text-sm text-muted-foreground">Searching…</p>
                        ) : scouted.length === 0 ? (
                            <p className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                                No players match that yet. Try widening the filters.
                            </p>
                        ) : (
                            <>
                                {scouted.map((person) => (
                                    <Row
                                        key={person.id}
                                        person={person}
                                        meta={<ScoutMeta person={person} />}
                                        action={
                                            <InviteButton
                                                disabled={sending}
                                                onClick={() => invite(person)}
                                            />
                                        }
                                    />
                                ))}
                                <p className="pt-1 text-xs text-muted-foreground">
                                    Players with a more complete profile are shown first.
                                </p>
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

/** Shared invite CTA — identical in both pools, so it lives in one place. */
function InviteButton({ disabled, onClick }) {
    return (
        <Button size="sm" className="rounded-full" disabled={disabled} onClick={onClick}>
            <UserPlus className="h-4 w-4" />
            Invite
        </Button>
    );
}

/** Filter dropdown with an "any" option that maps to "no filter". */
function FilterSelect({ value, onChange, options, anyLabel, capitalize = true }) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder={anyLabel} />
            </SelectTrigger>
            <SelectContent className="max-w-(--radix-select-trigger-width)">
                <SelectItem value={ANY}>
                    <span className="text-muted-foreground">{anyLabel}</span>
                </SelectItem>
                {options.map((o) => (
                    <SelectItem key={o} value={o} className={capitalize ? "capitalize" : ""}>
                        {capitalize ? String(o).replace(/_/g, " ") : o}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

/**
 * Sub-line for a scouted player: the sporting facts a captain is deciding on.
 * Falls back to location when the profile carries nothing sporting yet — such a
 * player ranks last anyway, but they shouldn't render as a blank row.
 */
function ScoutMeta({ person }) {
    const p = person?.profile ?? null;
    const positions = Array.isArray(p?.preferred_positions) ? p.preferred_positions : [];

    const bits = [
        p?.skill_level,
        positions.slice(0, 2).join(", "),
        [person?.district, person?.division].filter(Boolean).join(", "),
    ].filter(Boolean);

    return (
        <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-xs capitalize text-muted-foreground">
                {bits.length ? bits.join(" · ").replace(/_/g, " ") : "New player"}
            </span>
            {person?.profile_completion_percent >= 80 && (
                <span className="shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    Full profile
                </span>
            )}
        </span>
    );
}

function Row({ person, meta, action }) {
    const name = playerName(person);
    return (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-2.5">
            <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={person?.profile_picture_url} alt={name} />
                    <AvatarFallback>{playerInitials(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{name}</p>
                    {meta ?? (
                        <span className="truncate text-xs text-muted-foreground">
                            {[person?.district, person?.division].filter(Boolean).join(", ")}
                        </span>
                    )}
                </div>
            </div>
            <div className="shrink-0">{action}</div>
        </div>
    );
}
