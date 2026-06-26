import AuthBrandPanel from "@/components/auth/AuthBrandPanel";
import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
    return (
        <div className="relative grid min-h-svh overflow-hidden bg-gradient-to-b from-[#eef3ef] to-[#e7f1ea] dark:from-[#0a1412] dark:to-[#0a0a0a] lg:grid-cols-2">
            <AuthBrandPanel className="border-r border-border" />

            <div className="relative flex items-center justify-center p-6 md:p-10">
                {/* ambient glow behind the card (mobile/sm too) */}
                <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-teal/15 blur-[120px] lg:hidden" />
                <div className="glass-card relative w-full max-w-md rounded-3xl p-8 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.4)]">
                    <LoginForm />
                </div>
            </div>
        </div>
    );
}
