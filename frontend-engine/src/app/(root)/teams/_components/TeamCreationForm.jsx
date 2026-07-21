"use client";

import { useState } from "react";
import { redirect, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus, Info, MapPin, Shield, X } from "lucide-react";

import InputField from "@/components/InputField";
import RequiredSign from "@/components/RequiredSign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTeamMutation, useGetSportsCatalogueQuery } from "@/store/api/apiSlice";
import { uploadSingleImageObj } from "@/utils/image-upload";
import { getApiErrorMessage } from "@/utils/apiError";

/**
 * Create-team form.
 *
 * `sport_id` is a real FK, so the options come from `GET /teams/sports` rather
 * than the hardcoded `SPORTS` list in utils/constants.js — a name string would
 * not satisfy the foreign key.
 *
 * The sport is deliberately the one field you can't casually change later: the
 * backend locks it once a second player joins, because every member's
 * `position_id` belongs to the chosen sport.
 */
const teamSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Give your team a name (at least 2 characters)")
        .max(100, "Team name cannot be longer than 100 characters"),
    sport_id: z.string().min(1, "Pick the sport this team plays"),
    home_area: z.string().trim().max(100, "Keep the area under 100 characters").optional(),
    description: z.string().trim().max(500, "Keep the description under 500 characters").optional(),
});

// A section card — mirrors the match-creation form so the two feel like one app.
function Section({ icon: Icon, title, subtitle, children }) {
    return (
        <section className="glass-card rounded-2xl p-5 md:p-6">
            <div className="mb-5 flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-4.5 w-4.5" />
                </span>
                <div>
                    <h2 className="text-base font-bold text-foreground">{title}</h2>
                    {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
                </div>
            </div>
            {children}
        </section>
    );
}

export default function TeamCreationForm() {
    const router = useRouter();
    const { status } = useSession();
    const { data: sports = [], isLoading: sportsLoading } = useGetSportsCatalogueQuery();
    const [createTeam, { isLoading: isSubmitting }] = useCreateTeamMutation();

    const [submitError, setSubmitError] = useState(null);
    // Crest is held as a { file } object and only uploaded at submit time — the
    // same pattern the turf and match forms use (see utils/image-upload.js).
    const [crest, setCrest] = useState(null);
    const [uploading, setUploading] = useState(false);

    const {
        register,
        control,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(teamSchema),
        defaultValues: { name: "", sport_id: "", home_area: "", description: "" },
    });

    const onSubmit = async (values) => {
        setSubmitError(null);
        try {
            // Upload first: if imgbb fails we'd rather not have created a
            // half-configured team already.
            let crest_url = null;
            if (crest?.file) {
                setUploading(true);
                crest_url = await uploadSingleImageObj(crest);
                setUploading(false);
            }

            const team = await createTeam({
                name: values.name,
                sport_id: values.sport_id,
                home_area: values.home_area || undefined,
                description: values.description || undefined,
                ...(crest_url ? { crest_url } : {}),
            }).unwrap();

            const newId = team?.data?.id;
            router.push(newId ? `/teams/${newId}` : "/teams");
        } catch (error) {
            setUploading(false);
            setSubmitError(getApiErrorMessage(error, "Failed to create the team."));
        }
    };

    if (status === "loading") return null;
    if (status === "unauthenticated") redirect("/login");

    const busy = isSubmitting || uploading;

    return (
        <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            {submitError && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-center text-sm font-medium text-destructive">
                    {submitError}
                </div>
            )}

            {/* ---- Identity ---- */}
            <Section icon={Shield} title="Identity" subtitle="What's the squad called?">
                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label>Team name <RequiredSign /></Label>
                        <InputField errors={errors}>
                            <Input
                                type="text"
                                id="name"
                                placeholder="e.g. Gulshan United"
                                className={errors?.name ? "border-2 border-red-500" : ""}
                                {...register("name")}
                            />
                        </InputField>
                    </div>

                    <div className="space-y-2">
                        <Label>Sport <RequiredSign /></Label>
                        <InputField errors={errors}>
                            <Controller
                                name="sport_id"
                                control={control}
                                render={({ field }) => (
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <SelectTrigger
                                            className={`w-full ${errors?.sport_id ? "border-2 border-red-500" : ""}`}
                                        >
                                            <SelectValue
                                                placeholder={sportsLoading ? "Loading sports…" : "Select a sport"}
                                            />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {sports.map((sport) => (
                                                <SelectItem key={sport.id} value={sport.id}>
                                                    <span className="capitalize">{sport.name}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                        </InputField>
                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                            <Info className="mt-0.5 h-3 w-3 shrink-0" />
                            Pick carefully — once a second player joins, the sport is locked, because
                            everyone's position belongs to it.
                        </p>
                    </div>

                    {/* Crest — optional, uploaded on submit. */}
                    <div className="space-y-2">
                        <Label>Team crest</Label>
                        {crest ? (
                            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                                {/* Local object URL: the file hasn't been uploaded yet. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={URL.createObjectURL(crest.file)}
                                    alt="Team crest preview"
                                    className="h-12 w-12 rounded-lg object-cover"
                                />
                                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                                    {crest.file.name}
                                </span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => setCrest(null)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition hover:border-primary/50 hover:text-foreground">
                                <ImagePlus className="h-4 w-4" />
                                Upload a crest (optional)
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) setCrest({ file });
                                    }}
                                />
                            </label>
                        )}
                    </div>
                </div>
            </Section>

            {/* ---- Details ---- */}
            <Section icon={MapPin} title="Details" subtitle="Optional — helps players find you.">
                <div className="space-y-5">
                    <div className="space-y-2">
                        <Label>Home area</Label>
                        <InputField errors={errors}>
                            <Input
                                type="text"
                                id="home_area"
                                placeholder="e.g. Gulshan"
                                className={errors?.home_area ? "border-2 border-red-500" : ""}
                                {...register("home_area")}
                            />
                        </InputField>
                    </div>

                    <div className="space-y-2">
                        <Label>About the team</Label>
                        <InputField errors={errors}>
                            <Textarea
                                id="description"
                                placeholder="When do you play, what's the vibe?"
                                className={`min-h-24 ${errors?.description ? "border-2 border-red-500" : ""}`}
                                {...register("description")}
                            />
                        </InputField>
                    </div>
                </div>
            </Section>

            {/* ---- Sticky submit bar ---- */}
            <div className="sticky bottom-0 z-10 -mx-1 flex items-center justify-end gap-3 rounded-t-2xl border-t border-border bg-background/80 px-1 py-4 backdrop-blur">
                <Button type="button" variant="ghost" onClick={() => router.push("/teams")}>
                    Cancel
                </Button>
                <Button type="submit" disabled={busy} className="green-glow min-w-40 gap-2">
                    <Shield className="h-4 w-4" />
                    {uploading ? "Uploading…" : isSubmitting ? "Creating…" : "Create Team"}
                </Button>
            </div>
        </form>
    );
}
