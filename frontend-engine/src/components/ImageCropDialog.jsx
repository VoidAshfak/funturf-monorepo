"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import { Check, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "./ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "./ui/dialog";
import { cropAndUpload } from "@/utils/cropImage";
import { notifyError } from "@/lib/notify";

/**
 * Frame-and-upload dialog, shared by the cover photo and the avatar.
 *
 * The user drags/zooms inside a frame locked to the destination's aspect ratio,
 * so what they see here is exactly what the profile will render — no surprise
 * crops, no faces cut off by `object-cover`. The cropped result (not the
 * original) is what gets uploaded, which is why the picture always fits.
 *
 * @param {boolean}  open
 * @param {Function} onOpenChange
 * @param {string}   imageSrc     object URL of the picked file
 * @param {number}   aspect       width / height of the destination frame
 * @param {string}   [cropShape]  "rect" (default) or "round" for avatars
 * @param {number}   [maxWidth]   cap on the uploaded image's width
 * @param {string}   title
 * @param {string}   description
 * @param {Function} onUploaded   called with the hosted image URL
 */
export default function ImageCropDialog({
    open,
    onOpenChange,
    imageSrc,
    aspect = 1,
    cropShape = "rect",
    maxWidth = 1600,
    title = "Position your photo",
    description = "Drag to move, pinch or use the slider to zoom.",
    onUploaded,
}) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [areaPixels, setAreaPixels] = useState(null);
    const [saving, setSaving] = useState(false);

    // Reset the framing whenever a NEW image is loaded, so the previous photo's
    // zoom/offset doesn't carry over onto a differently-shaped one.
    useEffect(() => {
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setAreaPixels(null);
    }, [imageSrc]);

    const onCropComplete = useCallback((_area, croppedAreaPixels) => {
        setAreaPixels(croppedAreaPixels);
    }, []);

    const save = async () => {
        if (!imageSrc || !areaPixels) return;
        setSaving(true);
        try {
            const url = await cropAndUpload(imageSrc, areaPixels, { maxWidth });
            await onUploaded?.(url);
            onOpenChange(false);
        } catch (err) {
            notifyError(err?.message || "Couldn't upload that image.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={saving ? undefined : onOpenChange}>
            <DialogContent className="overflow-x-hidden sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>

                {/* Fixed-height stage — the cropper needs a positioned parent with
                    real dimensions to measure itself against. */}
                <div className="relative h-72 w-full overflow-hidden rounded-2xl bg-muted">
                    {imageSrc && (
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={aspect}
                            cropShape={cropShape}
                            showGrid={cropShape === "rect"}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={onCropComplete}
                            restrictPosition
                        />
                    )}
                </div>

                <div className="flex items-center gap-3 px-1">
                    <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                        type="range"
                        min={1}
                        max={4}
                        step={0.01}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        aria-label="Zoom"
                        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                    />
                    <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={save} disabled={saving || !areaPixels} className="green-glow gap-2">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {saving ? "Uploading…" : "Save photo"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
