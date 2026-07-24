"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Save, UserPen } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "./ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useUpdateMyProfileMutation } from "@/store/api/apiSlice";
import {
    BD_DIVISIONS,
    GENDERS,
    PLAYER_POSITIONS,
    PLAY_TIMES,
    PREFERRED_FEET,
    SKILL_LEVELS,
    SPORTS,
} from "@/utils/constants";
import { getApiErrorMessage } from "@/utils/apiError";
import { notifyError, notifySuccess } from "@/lib/notify";

// Form state is all strings (that's what inputs give us); `toPayload` below
// converts back to the types the API expects. `null` means "clear this field".
const UNSET = "__unset__";

/** A Date/ISO value -> "yyyy-MM-dd" for <input type="date">. */
const toDateInput = (v) => {
    if (!v) return "";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

/** Turn an enum value into readable text ("prefer_not_to_say" -> "prefer not to say"). */
const humanize = (v) => String(v).replace(/_/g, " ");

/**
 * Edit-your-own-profile dialog. Two tabs so the 20-odd fields don't read as a
 * wall: **Basics** (who you are) and **Player** (how you play).
 *
 * Only CHANGED fields are sent — the API treats an absent key as "leave it
 * alone" and an explicit null as "clear it", so diffing here keeps a save from
 * quietly rewriting fields the user never touched.
 *
 * @param {Object}  user       the profile DTO from GET /users/:id
 * @param {string}  [openTab]  which tab to land on ("basics" | "player")
 * @param {Object}  [trigger]  custom trigger element; defaults to an Edit button
 */
export default function EditProfileDialog({ user, defaultTab = "basics", trigger }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState(defaultTab);
    const [updateProfile, { isLoading }] = useUpdateMyProfileMutation();

    const profile = user?.player_profile ?? null;

    // Snapshot of the stored values, used to seed the form AND to diff on save.
    const initial = useMemo(
        () => ({
            // --- users ---
            first_name: user?.first_name ?? "",
            last_name: user?.last_name ?? "",
            phone: user?.phone ?? "",
            date_of_birth: toDateInput(user?.date_of_birth),
            gender: user?.gender ?? "",
            bio: user?.bio ?? "",
            division: user?.division ?? "",
            district: user?.district ?? "",
            // --- player_profiles ---
            skill_level: profile?.skill_level ?? "",
            years_of_experience:
                profile?.years_of_experience != null ? String(profile.years_of_experience) : "",
            preferred_foot: profile?.preferred_foot ?? "",
            jersey_number: profile?.jersey_number != null ? String(profile.jersey_number) : "",
            height_cm: profile?.height_cm != null ? String(profile.height_cm) : "",
            weight_kg: profile?.weight_kg != null ? String(profile.weight_kg) : "",
            preferred_play_time: profile?.preferred_play_time ?? "",
            max_travel_distance_km:
                profile?.max_travel_distance_km != null
                    ? String(profile.max_travel_distance_km)
                    : "",
            achievements: profile?.achievements ?? "",
        }),
        [user, profile]
    );

    // Multi-selects live outside the string form — they're arrays end to end.
    const initialPositions = useMemo(
        () => (Array.isArray(profile?.preferred_positions) ? profile.preferred_positions : []),
        [profile]
    );
    const initialSports = useMemo(
        () => (Array.isArray(profile?.sports_played) ? profile.sports_played : []),
        [profile]
    );

    const [form, setForm] = useState(initial);
    const [positions, setPositions] = useState(initialPositions);
    const [sports, setSports] = useState(initialSports);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    // Reset every time the dialog opens so a cancelled edit doesn't linger, and
    // land on whichever tab the caller asked for (the completion checklist deep
    // links straight to the tab holding the missing field).
    useEffect(() => {
        if (!open) return;
        setForm(initial);
        setPositions(initialPositions);
        setSports(initialSports);
        setTab(defaultTab);
    }, [open, initial, initialPositions, initialSports, defaultTab]);

    const toggle = (list, setList, value) =>
        setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

    const sameArray = (a, b) =>
        a.length === b.length && a.every((v, i) => v === b[i]);

    /** Changed fields only, converted to the API's types. */
    const toPayload = () => {
        const payload = {};

        const NUMERIC = new Set([
            "years_of_experience", "jersey_number", "height_cm",
            "weight_kg", "max_travel_distance_km",
        ]);

        for (const key of Object.keys(initial)) {
            if (form[key] === initial[key]) continue;

            const raw = form[key];
            if (raw === "" || raw === UNSET) {
                // Emptied -> explicitly clear it server-side.
                payload[key] = null;
            } else if (NUMERIC.has(key)) {
                payload[key] = Number(raw);
            } else {
                payload[key] = raw;
            }
        }

        if (!sameArray(positions, initialPositions)) payload.preferred_positions = positions;
        if (!sameArray(sports, initialSports)) payload.sports_played = sports;

        return payload;
    };

    const submit = async () => {
        const payload = toPayload();

        if (Object.keys(payload).length === 0) {
            setOpen(false);
            return;
        }

        try {
            await updateProfile(payload).unwrap();
            notifySuccess("Profile updated");
            setOpen(false);
            // The profile page is a server component — re-run it so the card shows
            // the new values (and the refreshed completion score).
            router.refresh();
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't save your profile."));
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button variant="outline" className="gap-2 rounded-full">
                        <Pencil className="h-4 w-4" /> Edit profile
                    </Button>
                )}
            </DialogTrigger>

            {/* min-w-0 on the body + overflow-x-hidden: DialogContent is a grid and
                grid items default to `min-width: auto`, so a long value could
                otherwise push the modal wider than its max-w. */}
            <DialogContent className="max-h-[85vh] overflow-y-auto overflow-x-hidden sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPen className="h-5 w-5 text-primary" /> Edit your profile
                    </DialogTitle>
                    <DialogDescription>
                        The more you fill in, the easier it is for squads to find you
                        and for us to match you to the right games.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={tab} onValueChange={setTab} className="min-w-0">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="basics">Basics</TabsTrigger>
                        <TabsTrigger value="player">Player</TabsTrigger>
                    </TabsList>

                    {/* ---------------- Basics ---------------- */}
                    <TabsContent value="basics" className="min-w-0 space-y-4 py-2">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="First name">
                                <Input
                                    value={form.first_name}
                                    onChange={(e) => set("first_name", e.target.value)}
                                />
                            </Field>
                            <Field label="Last name">
                                <Input
                                    value={form.last_name}
                                    onChange={(e) => set("last_name", e.target.value)}
                                />
                            </Field>
                        </div>

                        <Field label="Bio">
                            <Textarea
                                className="min-h-20"
                                placeholder="How do you play? Who do you usually play with?"
                                maxLength={1000}
                                value={form.bio}
                                onChange={(e) => set("bio", e.target.value)}
                            />
                        </Field>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="Phone">
                                <Input
                                    type="tel"
                                    placeholder="01XXXXXXXXX"
                                    value={form.phone}
                                    onChange={(e) => set("phone", e.target.value)}
                                />
                            </Field>
                            <Field label="Date of birth">
                                <Input
                                    type="date"
                                    value={form.date_of_birth}
                                    onChange={(e) => set("date_of_birth", e.target.value)}
                                />
                            </Field>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <Field label="Gender">
                                <EnumSelect
                                    value={form.gender}
                                    onChange={(v) => set("gender", v)}
                                    options={GENDERS}
                                    placeholder="Gender"
                                />
                            </Field>
                            <Field label="Division">
                                <EnumSelect
                                    value={form.division}
                                    onChange={(v) => set("division", v)}
                                    options={BD_DIVISIONS}
                                    placeholder="Division"
                                    capitalize={false}
                                />
                            </Field>
                            <Field label="District">
                                <Input
                                    placeholder="e.g. Gazipur"
                                    value={form.district}
                                    onChange={(e) => set("district", e.target.value)}
                                />
                            </Field>
                        </div>
                    </TabsContent>

                    {/* ---------------- Player ---------------- */}
                    <TabsContent value="player" className="min-w-0 space-y-4 py-2">
                        <Field label="Sports you play">
                            <ChipGroup
                                options={SPORTS}
                                selected={sports}
                                onToggle={(v) => toggle(sports, setSports, v)}
                            />
                        </Field>

                        <Field label="Preferred positions">
                            <ChipGroup
                                options={PLAYER_POSITIONS}
                                selected={positions}
                                onToggle={(v) => toggle(positions, setPositions, v)}
                            />
                        </Field>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <Field label="Skill level">
                                <EnumSelect
                                    value={form.skill_level}
                                    onChange={(v) => set("skill_level", v)}
                                    options={SKILL_LEVELS}
                                    placeholder="Skill level"
                                />
                            </Field>
                            <Field label="Preferred play time">
                                <EnumSelect
                                    value={form.preferred_play_time}
                                    onChange={(v) => set("preferred_play_time", v)}
                                    options={PLAY_TIMES}
                                    placeholder="When do you play?"
                                />
                            </Field>
                        </div>

                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                            <Field label="Preferred foot">
                                <EnumSelect
                                    value={form.preferred_foot}
                                    onChange={(v) => set("preferred_foot", v)}
                                    options={PREFERRED_FEET}
                                    placeholder="Foot"
                                />
                            </Field>
                            <Field label="Years of experience">
                                <Input
                                    type="number"
                                    min={0}
                                    max={60}
                                    value={form.years_of_experience}
                                    onChange={(e) => set("years_of_experience", e.target.value)}
                                />
                            </Field>
                            <Field label="Jersey number">
                                <Input
                                    type="number"
                                    min={0}
                                    max={99}
                                    value={form.jersey_number}
                                    onChange={(e) => set("jersey_number", e.target.value)}
                                />
                            </Field>
                        </div>

                        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                            <Field label="Height (cm)">
                                <Input
                                    type="number"
                                    min={50}
                                    max={260}
                                    value={form.height_cm}
                                    onChange={(e) => set("height_cm", e.target.value)}
                                />
                            </Field>
                            <Field label="Weight (kg)">
                                <Input
                                    type="number"
                                    min={20}
                                    max={250}
                                    value={form.weight_kg}
                                    onChange={(e) => set("weight_kg", e.target.value)}
                                />
                            </Field>
                            <Field label="Travel range (km)">
                                <Input
                                    type="number"
                                    min={0}
                                    max={200}
                                    value={form.max_travel_distance_km}
                                    onChange={(e) => set("max_travel_distance_km", e.target.value)}
                                />
                            </Field>
                        </div>

                        <Field label="Achievements">
                            <Textarea
                                className="min-h-20"
                                placeholder="Tournaments, trophies, anything worth knowing"
                                maxLength={1000}
                                value={form.achievements}
                                onChange={(e) => set("achievements", e.target.value)}
                            />
                        </Field>
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={submit} disabled={isLoading} className="green-glow gap-2">
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Save profile
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --- small building blocks -------------------------------------------------

function Field({ label, children }) {
    // min-w-0 so a wide child can never force the grid parent past the dialog.
    return (
        <div className="min-w-0 space-y-1.5">
            <Label className="text-xs text-muted-foreground">{label}</Label>
            {children}
        </div>
    );
}

/**
 * Select over a fixed option list. Radix forbids an empty-string item value, so
 * "not set" rides a sentinel and is translated back to "" for the form.
 */
function EnumSelect({ value, onChange, options, placeholder, capitalize = true }) {
    return (
        <Select
            value={value || UNSET}
            onValueChange={(v) => onChange(v === UNSET ? "" : v)}
        >
            <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="max-w-(--radix-select-trigger-width)">
                <SelectItem value={UNSET}>
                    <span className="text-muted-foreground">Not set</span>
                </SelectItem>
                {options.map((o) => (
                    <SelectItem key={o} value={o} className={capitalize ? "capitalize" : ""}>
                        {capitalize ? humanize(o) : o}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

/** Toggleable chips for the JSON array fields (sports, positions). */
function ChipGroup({ options, selected, onToggle }) {
    return (
        <div className="flex flex-wrap gap-2">
            {options.map((o) => {
                const active = selected.includes(o);
                return (
                    <button
                        key={o}
                        type="button"
                        onClick={() => onToggle(o)}
                        aria-pressed={active}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                            active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                    >
                        {humanize(o)}
                    </button>
                );
            })}
        </div>
    );
}
