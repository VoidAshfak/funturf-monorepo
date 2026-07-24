"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import ImageCropDialog from "./ImageCropDialog";
import { useUpdateMyProfileMutation } from "@/store/api/apiSlice";
import { readImageFile } from "@/utils/cropImage";
import { getApiErrorMessage } from "@/utils/apiError";
import { notifyError, notifySuccess } from "@/lib/notify";

/**
 * Camera badge overlaid on the profile avatar, for the profile's owner only.
 *
 * Rendered as an absolutely-positioned sibling of the <Avatar> (the parent must
 * be `relative`), so the avatar itself stays a plain server-rendered element and
 * only this badge ships as client JS.
 *
 * Crops to a 1:1 circle before upload — a square source means the avatar is never
 * squashed, whatever shape the original photo was.
 */
export default function ProfileAvatarEditor() {
    const router = useRouter();
    const fileInputRef = useRef(null);
    const [pickedSrc, setPickedSrc] = useState(null);
    const [cropOpen, setCropOpen] = useState(false);
    const [updateProfile] = useUpdateMyProfileMutation();

    useEffect(() => {
        return () => {
            if (pickedSrc) URL.revokeObjectURL(pickedSrc);
        };
    }, [pickedSrc]);

    const onPick = (e) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // let the same file be picked again
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
            await updateProfile({ profile_picture_url: url }).unwrap();
            notifySuccess("Profile photo updated");
            router.refresh();
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't save your profile photo."));
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Change profile photo"
                className="absolute bottom-1 right-1 grid h-10 w-10 place-items-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-110"
            >
                <Camera className="h-4 w-4" />
            </button>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onPick}
                className="hidden"
                aria-label="Upload a profile photo"
            />
            <ImageCropDialog
                open={cropOpen}
                onOpenChange={setCropOpen}
                imageSrc={pickedSrc}
                aspect={1}
                cropShape="round"
                // Native resolution, same as the cover — the avatar is also used
                // at 144px on the profile card and much smaller in lists, and
                // next/image picks the right size per slot.
                idealWidth={512}
                title="Position your profile photo"
                description="Drag to move, zoom to frame your face."
                onUploaded={onUploaded}
            />
        </>
    );
}
