import { Suspense } from "react";
import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
import { ResetPasswordForm } from "@/components/forms/reset-password-form";

export const metadata = {
    title: "Reset password · FunTurf",
    description: "Choose a new password for your FunTurf account.",
    // The URL carries a single-use token — keep it out of search indexes and out
    // of the Referer header of any link the page might contain.
    robots: { index: false, follow: false },
    referrer: "no-referrer",
};

/**
 * Step 2 of password recovery: the target of the emailed link
 * (`/reset-password?token=…`).
 *
 * The token is read client-side by the form (via useSearchParams) rather than
 * server-side, so it never reaches this server component — nothing to
 * accidentally log or embed in the SSR payload. `Suspense` is required because
 * useSearchParams opts the subtree into client-side rendering.
 */
export default function ResetPasswordPage() {
    return (
        <div className="relative grid min-h-svh overflow-hidden bg-gradient-to-b from-[#eef3ef] to-[#e7f1ea] dark:from-[#0a1412] dark:to-[#0a0a0a] lg:grid-cols-2">
            <AuthBrandPanel className="border-r border-border" />

            <div className="relative flex items-center justify-center p-6 md:p-10">
                <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-teal/15 blur-[120px] lg:hidden" />
                <div className="glass-card relative w-full max-w-md rounded-3xl p-8 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.4)]">
                    <Suspense
                        fallback={
                            <p className="text-muted-foreground py-8 text-center text-sm">
                                Checking your reset link…
                            </p>
                        }
                    >
                        <ResetPasswordForm />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
