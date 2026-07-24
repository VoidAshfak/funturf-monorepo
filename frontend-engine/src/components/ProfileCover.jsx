"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import ImageCropDialog from "./ImageCropDialog";
import PhotoViewer from "./PhotoViewer";
import { useUpdateMyProfileMutation } from "@/store/api/apiSlice";
import { readImageFile } from "@/utils/cropImage";
import { getApiErrorMessage } from "@/utils/apiError";
import { notifyError, notifySuccess } from "@/lib/notify";

// The banner is cropped to this ratio on upload, so it fills the desktop banner
// edge to edge with nothing important cut off. Narrow screens still trim the
// sides (the banner box is much squarer there) — that's why the crop dialog says
// to keep the subject centred.
const COVER_ASPECT = 4 / 1;

// Below this the banner starts looking soft: the layout runs to ~1080 CSS px, and
// a 2x display needs roughly double that. Purely advisory — a smaller crop is
// still accepted, the dialog just warns first rather than silently upscaling.
const IDEAL_COVER_WIDTH = 1600;

/** Shown until a player uploads their own cover. */
const DEFAULT_COVER = "/assets/images/bg3.jpg";

/**
 * Profile banner, with in-place cover-photo editing for the profile's owner.
 *
 * Visitors just see the image. The owner gets a "Change cover" affordance that
 * opens the shared crop dialog; the CROPPED result is uploaded and PATCHed to
 * `users/me`, then `router.refresh()` re-runs the server component so the new
 * banner appears without a manual reload.
 */
export default function ProfileCover({ coverUrl, isOwner = false }) {
    const router = useRouter();
    const fileInputRef = useRef(null);
    const [pickedSrc, setPickedSrc] = useState(null);
    const [cropOpen, setCropOpen] = useState(false);
    const [updateProfile] = useUpdateMyProfileMutation();

    // Object URLs are a leak if we never hand them back to the browser.
    useEffect(() => {
        return () => {
            if (pickedSrc) URL.revokeObjectURL(pickedSrc);
        };
    }, [pickedSrc]);

    const onPick = (e) => {
        const file = e.target.files?.[0];
        // Clear the input straight away so picking the SAME file twice still fires
        // a change event (a re-crop of the same photo is a normal thing to want).
        e.target.value = "";
        if (!file) return;

        try {
            setPickedSrc(readImageFile(file));
            setCropOpen(true);
        } catch (err) {
            notifyError(err.message);
        }
    };

    const onUploaded = async (url) => {
        try {
            await updateProfile({ cover_photo_url: url }).unwrap();
            notifySuccess("Cover photo updated");
            router.refresh();
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't save your cover photo."));
        }
    };

    return (
        <div className="relative h-64 w-full overflow-hidden md:h-80">
            <Image
                src={coverUrl || DEFAULT_COVER}
                alt="Profile banner"
                fill
                priority
                sizes="100vw"
                className="object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            {/* brand tint */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent mix-blend-overlay" />

            {/*
                Click-to-enlarge layer. Sits above the (now pointer-transparent)
                gradients but BEFORE the edit button in the DOM, so the edit button
                paints — and receives clicks — on top of it. Only wired up when a
                real cover exists; enlarging the stock placeholder is noise.
            */}
            {coverUrl && (
                <PhotoViewer
                    src={coverUrl}
                    alt="Cover photo"
                    label="View cover photo"
                    className="absolute inset-0 h-full w-full"
                >
                    <span className="sr-only">View cover photo</span>
                </PhotoViewer>
            )}

            {isOwner && (
                <>
                    {/*
                        Bottom-right, and ALWAYS visible.

                        Not top-right: the navbar is `fixed top-0 z-50` and sits in
                        its own stacking context above this whole page, so anything
                        near the top of the banner is unreachable behind it.

                        Not hover-to-reveal either: an edit control nobody can see
                        is an edit control nobody uses, and it doesn't exist at all
                        on touch.

                        `bottom-20` / `md:bottom-24` clears the profile card, which
                        overlaps the banner by `-mt-16` / `md:-mt-20` and carries
                        `z-10` — since this button's own parent has an auto z-index,
                        the card would paint over it wherever the two overlap, so
                        the gap has to be real rather than fixed with z-index.
                    */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-20 right-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/85 px-4 py-2 text-sm font-semibold text-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-background md:bottom-24 md:right-6"
                    >
                        <Camera className="h-4 w-4 text-primary" />
                        <span className="hidden sm:inline">Change cover</span>
                        <span className="sm:hidden">Cover</span>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={onPick}
                        className="hidden"
                        aria-label="Upload a cover photo"
                    />
                    <ImageCropDialog
                        open={cropOpen}
                        onOpenChange={setCropOpen}
                        imageSrc={pickedSrc}
                        aspect={COVER_ASPECT}
                        // No maxWidth: the crop uploads at its native resolution.
                        // `next/image` resizes per breakpoint on the way out, so a
                        // large stored original costs nothing at render time and is
                        // what keeps the banner sharp on HiDPI screens.
                        idealWidth={IDEAL_COVER_WIDTH}
                        title="Position your cover photo"
                        description="Drag to move, zoom to fill the banner. Keep the subject centred — narrow screens trim the edges."
                        onUploaded={onUploaded}
                    />
                </>
            )}
        </div>
    );
}
