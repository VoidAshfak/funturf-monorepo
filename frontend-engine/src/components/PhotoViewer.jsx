"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "./ui/dialog";

/**
 * Click-to-enlarge wrapper for a single photo (profile picture, cover banner).
 *
 * Wraps whatever it's given in a button that opens the image full-bleed. When
 * there is no image to show it renders the children untouched — a placeholder
 * avatar or the stock banner isn't worth a lightbox, and a button that opens
 * nothing is worse than no button.
 *
 * The enlarged view uses `object-contain` in a viewport-sized box, so any aspect
 * ratio fits without cropping — the point is to see the whole photo, which is
 * exactly what the cropped thumbnail can't show you.
 *
 * @param {string}  src        image URL; falsy disables the whole behaviour
 * @param {string}  alt
 * @param {string}  [label]    accessible name for the trigger
 * @param {string}  [className] classes for the trigger button (match the child's shape)
 * @param {Node}    children   what the user actually clicks
 */
export default function PhotoViewer({ src, alt = "", label, className = "", children }) {
    const [open, setOpen] = useState(false);

    if (!src) return children;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={label || `View ${alt || "photo"}`}
                className={`block cursor-zoom-in ${className}`}
            >
                {children}
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
                {/* Transparent, borderless shell: the photo IS the content, so the
                    usual card chrome would just box it in. The stock close button
                    is replaced — a bare X inherits `foreground` and vanishes
                    against a light photo. */}
                <DialogContent
                    showCloseButton={false}
                    className="w-[95vw] max-w-5xl border-0 bg-transparent p-0 shadow-none sm:max-w-5xl"
                >
                    {/* Radix requires a title for screen readers even when the
                        dialog is purely visual. */}
                    <DialogTitle className="sr-only">{alt || "Photo"}</DialogTitle>

                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        aria-label="Close photo"
                        className="absolute -top-3 right-0 z-10 grid h-10 w-10 place-items-center rounded-full border border-border bg-background/85 text-foreground shadow-lg backdrop-blur-md transition-colors hover:bg-background"
                    >
                        <X className="h-4 w-4" />
                    </button>

                    <div className="relative h-[80vh] w-full">
                        <Image
                            src={src}
                            alt={alt}
                            fill
                            sizes="95vw"
                            className="object-contain"
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
