import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
import { ForgotPasswordForm } from "@/components/forms/forgot-password-form";

export const metadata = {
    title: "Forgot password · FunTurf",
    description: "Get a link to reset your FunTurf password.",
};

/**
 * Step 1 of password recovery: ask for the reset email.
 *
 * Same shell as /login on purpose — a user bounced here mid-login should feel
 * they are still in the same flow, not on some other site.
 */
export default function ForgotPasswordPage() {
    return (
        <div className="relative grid min-h-svh overflow-hidden bg-gradient-to-b from-[#eef3ef] to-[#e7f1ea] dark:from-[#0a1412] dark:to-[#0a0a0a] lg:grid-cols-2">
            <AuthBrandPanel className="border-r border-border" />

            <div className="relative flex items-center justify-center p-6 md:p-10">
                <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-teal/15 blur-[120px] lg:hidden" />
                <div className="glass-card relative w-full max-w-md rounded-3xl p-8 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.4)]">
                    <ForgotPasswordForm />
                </div>
            </div>
        </div>
    );
}
