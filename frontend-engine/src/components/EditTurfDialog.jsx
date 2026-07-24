"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ImageIcon, Loader2, Palette, Pencil, RotateCcw, Save, Trash2 } from "lucide-react";
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
import ImageCropDialog from "./ImageCropDialog";
import { useUpdateVenueMutation } from "@/store/api/apiSlice";
import { readImageFile } from "@/utils/cropImage";
import { extractDominantColor, normalizeAccent } from "@/utils/turfTheme";
import { getApiErrorMessage } from "@/utils/apiError";
import { notifyError, notifySuccess } from "@/lib/notify";

// A logo is a square mark; the cover is the wide photo on the public turf page.
const LOGO_ASPECT = 1;
const COVER_ASPECT = 16 / 9;
const IDEAL_LOGO_WIDTH = 256;
const IDEAL_COVER_WIDTH = 1280;

/** Which picker the shared crop dialog is currently serving. */
const NONE = null;

/**
 * "Edit turf" dialog for the turf's own admin.
 *
 * Covers the identity fields that used to be frozen after the create-turf
 * wizard: name, description, logo, cover photo, and the accent colour the admin
 * panel themes itself with.
 *
 * Only CHANGED fields are sent. The API treats an absent key as "leave it alone"
 * and an explicit null as "clear it", so diffing here stops a save from quietly
 * rewriting something the owner never touched.
 *
 * `isOwner` is decided server-side by the page; the API independently enforces
 * that only the turf's own admin can write to it.
 */
export default function EditTurfDialog({ venue }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [updateVenue, { isLoading }] = useUpdateVenueMutation();

    // ---- form state -------------------------------------------------------
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [logoUrl, setLogoUrl] = useState(null);
    const [coverUrl, setCoverUrl] = useState(null);
    const [themeColor, setThemeColor] = useState("");

    // ---- image picking ----------------------------------------------------
    const [target, setTarget] = useState(NONE); // "logo" | "cover"
    const [pickedSrc, setPickedSrc] = useState(null);
    const [cropOpen, setCropOpen] = useState(false);
    const logoInputRef = useRef(null);
    const coverInputRef = useRef(null);

    // Reload the form from the turf every time the dialog opens, so a cancelled
    // edit never leaks into the next one.
    useEffect(() => {
        if (!open) return;
        setName(venue?.name ?? "");
        setDescription(venue?.description ?? "");
        setLogoUrl(venue?.logo_url ?? null);
        setCoverUrl(venue?.images?.[0] ?? null);
        setThemeColor(venue?.theme_color ?? "");
    }, [open, venue]);

    // Object URLs leak unless handed back to the browser.
    useEffect(() => {
        return () => {
            if (pickedSrc) URL.revokeObjectURL(pickedSrc);
        };
    }, [pickedSrc]);

    const onPick = (which) => (e) => {
        const file = e.target.files?.[0];
        // Clear immediately so re-picking the SAME file still fires a change event.
        e.target.value = "";
        if (!file) return;
        try {
            setTarget(which);
            setPickedSrc(readImageFile(file));
            setCropOpen(true);
        } catch (err) {
            notifyError(err.message);
        }
    };

    const onUploaded = async (url) => {
        if (target === "logo") {
            setLogoUrl(url);
            // Sample the accent from the LOCAL file, not the hosted URL: the local
            // object URL can't taint the canvas and needs no CORS round-trip. Only
            // suggest — never overwrite a colour the owner set by hand.
            if (!themeColor) {
                try {
                    const sampled = await extractDominantColor(pickedSrc);
                    if (sampled) setThemeColor(sampled);
                } catch {
                    // A monochrome or unreadable logo just means no suggestion.
                }
            }
        } else if (target === "cover") {
            setCoverUrl(url);
        }
        setTarget(NONE);
    };

    /** Only what actually changed; "" / null both mean "clear it". */
    const buildPayload = () => {
        const payload = {};
        const trimmedName = name.trim();

        if (trimmedName !== (venue?.name ?? "")) payload.name = trimmedName;

        const trimmedDesc = description.trim();
        if (trimmedDesc !== (venue?.description ?? "")) {
            payload.description = trimmedDesc || null;
        }

        if ((logoUrl ?? null) !== (venue?.logo_url ?? null)) payload.logo_url = logoUrl ?? null;

        const currentCover = venue?.images?.[0] ?? null;
        if ((coverUrl ?? null) !== currentCover) {
            // Element 0 is the cover; keep any additional photos behind it.
            const rest = Array.isArray(venue?.images) ? venue.images.slice(1) : [];
            payload.images = coverUrl ? [coverUrl, ...rest] : rest;
        }

        const normalized = themeColor ? normalizeAccent(themeColor) : null;
        if ((normalized ?? null) !== (venue?.theme_color ?? null)) {
            payload.theme_color = normalized;
        }

        return payload;
    };

    const save = async () => {
        if (!name.trim()) {
            notifyError("Turf name can't be empty.");
            return;
        }

        // A half-typed hex ("#1db") normalises to null, which the API reads as
        // "clear the colour" — so reject it here rather than silently wiping a
        // colour the owner was in the middle of editing. Empty is still valid:
        // that's the explicit "back to default" case.
        if (themeColor && !normalizeAccent(themeColor)) {
            notifyError("That colour isn't valid. Use a hex value like #1db954.");
            return;
        }

        const payload = buildPayload();
        if (Object.keys(payload).length === 0) {
            setOpen(false);
            return;
        }

        try {
            await updateVenue({ venueId: venue.id, ...payload }).unwrap();
            notifySuccess("Turf updated");
            setOpen(false);
            // The dashboard reads the turf server-side (name, logo and palette all
            // come from the layout), so re-run the server components.
            router.refresh();
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't save your turf."));
        }
    };

    return (
        <>
        <Dialog open={open} onOpenChange={isLoading ? undefined : setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-lg">
                    <Pencil className="h-4 w-4" />
                    Edit Turf
                </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[85vh] overflow-y-auto overflow-x-hidden sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Edit turf</DialogTitle>
                    <DialogDescription>
                        Your name, logo and colour show across the admin panel and on your
                        public turf page.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-w-0 space-y-5 py-2">
                    {/* ---- logo ---- */}
                    <div className="space-y-2">
                        <Label>Logo</Label>
                        <div className="flex items-center gap-3">
                            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-muted">
                                {logoUrl ? (
                                    <Image
                                        src={logoUrl}
                                        alt="Turf logo"
                                        width={64}
                                        height={64}
                                        className="h-16 w-16 object-contain"
                                    />
                                ) : (
                                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                )}
                            </span>
                            <div className="flex min-w-0 flex-col gap-1.5">
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => logoInputRef.current?.click()}
                                    >
                                        {logoUrl ? "Replace" : "Upload"}
                                    </Button>
                                    {logoUrl && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="ghost"
                                            className="gap-1.5 text-destructive hover:text-destructive"
                                            onClick={() => setLogoUrl(null)}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" /> Remove
                                        </Button>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Square. A transparent PNG looks best on both themes.
                                </p>
                            </div>
                        </div>
                        <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/*"
                            onChange={onPick("logo")}
                            className="hidden"
                            aria-label="Upload a turf logo"
                        />
                    </div>

                    {/* ---- name ---- */}
                    <div className="space-y-2">
                        <Label htmlFor="turf-name">Turf name</Label>
                        <Input
                            id="turf-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            maxLength={255}
                            placeholder="Gulshan Sports Arena"
                        />
                        <p className="text-xs text-muted-foreground">
                            Renaming won&apos;t break existing links — your turf keeps the same
                            address.
                        </p>
                    </div>

                    {/* ---- description ---- */}
                    <div className="space-y-2">
                        <Label htmlFor="turf-description">Description</Label>
                        <Textarea
                            id="turf-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={2000}
                            rows={3}
                            placeholder="Two floodlit 7-a-side pitches with parking."
                        />
                    </div>

                    {/* ---- cover photo ---- */}
                    <div className="space-y-2">
                        <Label>Cover photo</Label>
                        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted">
                            {coverUrl ? (
                                <Image
                                    src={coverUrl}
                                    alt="Turf cover"
                                    fill
                                    sizes="(max-width: 640px) 100vw, 480px"
                                    className="object-cover"
                                />
                            ) : (
                                <span className="grid h-full w-full place-items-center text-xs text-muted-foreground">
                                    No cover photo yet
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => coverInputRef.current?.click()}
                            >
                                {coverUrl ? "Replace cover" : "Upload cover"}
                            </Button>
                            {coverUrl && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="gap-1.5 text-destructive hover:text-destructive"
                                    onClick={() => setCoverUrl(null)}
                                >
                                    <Trash2 className="h-3.5 w-3.5" /> Remove
                                </Button>
                            )}
                        </div>
                        <input
                            ref={coverInputRef}
                            type="file"
                            accept="image/*"
                            onChange={onPick("cover")}
                            className="hidden"
                            aria-label="Upload a turf cover photo"
                        />
                    </div>

                    {/* ---- panel accent ---- */}
                    <div className="space-y-2">
                        <Label htmlFor="turf-color" className="flex items-center gap-1.5">
                            <Palette className="h-3.5 w-3.5 text-primary" /> Panel colour
                        </Label>
                        <div className="flex items-center gap-2">
                            <input
                                id="turf-color"
                                type="color"
                                value={themeColor || "#1db954"}
                                onChange={(e) => setThemeColor(e.target.value)}
                                className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-1"
                                aria-label="Pick a panel accent colour"
                            />
                            <Input
                                value={themeColor}
                                onChange={(e) => setThemeColor(e.target.value)}
                                placeholder="#1db954"
                                className="font-mono"
                                maxLength={7}
                            />
                            {themeColor && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="shrink-0 gap-1.5"
                                    onClick={() => setThemeColor("")}
                                >
                                    <RotateCcw className="h-3.5 w-3.5" /> Default
                                </Button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Picked from your logo when you upload one. It colours buttons and
                            highlights in your panel only — and is nudged into a readable range,
                            so the saved colour may differ slightly from the one you pick. Clear
                            it to go back to FunTurf green.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button onClick={save} disabled={isLoading} className="green-glow gap-2">
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {isLoading ? "Saving…" : "Save changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

            {/* One cropper serving both pickers — `target` decides where the result
                lands. Kept OUTSIDE the edit dialog so it isn't a child of a modal
                that's still open: Radix stacks the two layers, and the cropper
                lands on top instead of fighting the edit dialog's focus trap. */}
            <ImageCropDialog
                open={cropOpen}
                onOpenChange={setCropOpen}
                imageSrc={pickedSrc}
                aspect={target === "cover" ? COVER_ASPECT : LOGO_ASPECT}
                idealWidth={target === "cover" ? IDEAL_COVER_WIDTH : IDEAL_LOGO_WIDTH}
                title={target === "cover" ? "Position your cover photo" : "Position your logo"}
                description={
                    target === "cover"
                        ? "Drag to move, zoom to fill. Keep the pitch in frame."
                        : "Drag to move, zoom to fit your mark inside the square."
                }
                onUploaded={onUploaded}
            />
        </>
    );
}
