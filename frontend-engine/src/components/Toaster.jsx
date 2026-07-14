"use client";

import { useTheme } from "next-themes";
import { Toaster as SonnerToaster } from "sonner";

/**
 * App-wide toast surface.
 *
 * Toasts carry two things (see lib/notify.js for the policy):
 *   - feedback for the user's own actions ("Booking placed", "Comment posted");
 *   - HIGH-priority live notifications pushed over the socket, which also land
 *     in the bell. Everything below high priority stays in the bell only, so we
 *     never interrupt someone mid-booking for a comment reply.
 *
 * Styled off the design tokens rather than sonner's defaults so toasts read as
 * part of the app (glassy dark surface, green only for success).
 */
export default function Toaster() {
    const { theme } = useTheme();

    return (
        <SonnerToaster
            theme={theme === "light" ? "light" : "dark"}
            position="bottom-right"
            closeButton
            richColors={false}
            // Long enough to read a two-line message, short enough to not linger.
            duration={5000}
            toastOptions={{
                classNames: {
                    toast: "glass-card !border-border !rounded-2xl !text-foreground",
                    title: "!font-bold",
                    description: "!text-muted-foreground",
                    actionButton: "!bg-primary !text-primary-foreground !font-semibold !rounded-full",
                    cancelButton: "!bg-muted !text-muted-foreground !rounded-full",
                    success: "!text-primary",
                    error: "!text-destructive",
                },
            }}
        />
    );
}
