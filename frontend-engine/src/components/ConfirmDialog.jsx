"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Reusable "are you sure?" gate for destructive / hard-to-undo actions
 * (remove turfmate, leave a match, cancel a join request). Nothing runs until
 * the user explicitly taps the confirm button, so a stray click can't undo a
 * connection or drop someone from a match by mistake.
 *
 * Built on Radix Dialog, so it gets a focus trap, ESC-to-close, and an
 * accessible title/description for free. The sporty pop-in/backdrop-blur comes
 * from the `.sporty-modal` / `.sporty-overlay` keyframes in globals.css.
 *
 * Props:
 *   open, onOpenChange  - controlled visibility (parent owns the state)
 *   title, description  - modal copy
 *   confirmLabel        - text on the action button (default "Confirm")
 *   cancelLabel         - text on the dismiss button (default "Cancel")
 *   tone                - "destructive" (default) | "default" -> confirm color
 *   Icon                - optional lucide icon shown in the header medallion
 *   onConfirm           - async fn; the dialog stays open if it throws (so the
 *                         caller's error toast is visible) and auto-closes on
 *                         success. Keep the caller's try/catch inside it.
 */
export default function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    tone = "destructive",
    Icon,
    onConfirm,
}) {
    // Local pending state drives the spinner and locks both buttons while the
    // action is in flight — prevents double-fire and a premature dismiss.
    const [pending, setPending] = useState(false);

    const handleConfirm = async () => {
        if (pending) return;
        try {
            setPending(true);
            await onConfirm?.();
            onOpenChange?.(false); // success -> close
        } catch {
            // Swallow here: onConfirm is expected to surface its own error toast.
            // We keep the modal open so the user sees what happened and can retry.
        } finally {
            setPending(false);
        }
    };

    const isDestructive = tone === "destructive";

    return (
        <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
            <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay
                    className="sporty-overlay fixed inset-0 z-50 bg-black/60"
                />
                <DialogPrimitive.Content
                    className={cn(
                        "sporty-modal glass-card fixed left-[50%] top-[50%] z-50 grid w-full max-w-[calc(100%-2rem)]",
                        "translate-x-[-50%] translate-y-[-50%] gap-4 rounded-2xl border border-border p-6",
                        "shadow-2xl sm:max-w-md"
                    )}
                    // Block the accidental-outside-click dismiss from feeling like
                    // a "no-op"; the Cancel button and ESC remain the way out.
                >
                    <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
                        {Icon && (
                            <span
                                className={cn(
                                    "grid h-11 w-11 shrink-0 place-items-center rounded-full",
                                    isDestructive
                                        ? "bg-destructive/15 text-destructive"
                                        : "bg-primary/15 text-primary"
                                )}
                            >
                                <Icon className="h-5 w-5" />
                            </span>
                        )}
                        <div className="min-w-0 space-y-1.5">
                            <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
                            {description && (
                                <DialogDescription>{description}</DialogDescription>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="mt-1">
                        <Button
                            variant="outline"
                            className="rounded-full"
                            disabled={pending}
                            onClick={() => onOpenChange?.(false)}
                        >
                            {cancelLabel}
                        </Button>
                        <Button
                            variant={isDestructive ? "destructive" : "default"}
                            className={cn("rounded-full", !isDestructive && "green-glow")}
                            disabled={pending}
                            onClick={handleConfirm}
                        >
                            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                            {confirmLabel}
                        </Button>
                    </DialogFooter>
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
