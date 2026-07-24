"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import ImageCropDialog from "./ImageCropDialog";
import { useUpdateMyProfileMutation } from "@/store/api/apiSlice";
import { readImageFile } from "@/utils/cropImage";
import { getApiErrorMessage } from "@/utils/apiError";
import { notifyError, notifySuccess } from "@/lib/notify";

// The banner is cropped to this ratio on upload, so it fills the desktop banner
// edge to edge with nothing important cut off. Narrow screens still trim the
// sides (the banner box is much squarer there) — that's why the crop dialog says
// to keep the subject centred.
const COVER_ASPECT = 4 / 1;

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
        <div className="group relative h-64 w-full overflow-hidden md:h-80">
            <Image
                src={coverUrl || DEFAULT_COVER}
                alt="Profile banner"
                fill
                priority
                sizes="100vw"
                className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            {/* brand tint */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent mix-blend-overlay" />

            {isOwner && (
                <>
                    {/* Always visible on touch devices (no hover there); on pointer
                        devices it fades up when the banner is hovered. */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-border bg-background/85 px-4 py-2 text-sm font-semibold text-foreground shadow-lg backdrop-blur-md transition-all hover:bg-background md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                    >
                        <Camera className="h-4 w-4 text-primary" />
                        Change cover
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
                        maxWidth={1600}
                        title="Position your cover photo"
                        description="Drag to move, zoom to fill the banner. Keep the subject centred — narrow screens trim the edges."
                        onUploaded={onUploaded}
                    />
                </>
            )}
        </div>
    );
}
