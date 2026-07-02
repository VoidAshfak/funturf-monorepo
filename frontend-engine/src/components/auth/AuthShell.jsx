import AuthBrandPanel from "@/components/auth/AuthBrandPanel";

/**
 * Shared auth-page layout: brand panel + centered glass card. Used by the
 * signup chooser and the player / turf-owner signup pages so they stay visually
 * consistent. `wide` widens the card for the long multi-field signup forms.
 */
export default function AuthShell({ children, wide = false }) {
    return (
        <div className="relative grid min-h-svh overflow-hidden bg-gradient-to-b from-[#eef3ef] to-[#e7f1ea] dark:from-[#0a1412] dark:to-[#0a0a0a] lg:grid-cols-5">
            <AuthBrandPanel className="border-r border-border lg:col-span-2 lg:sticky lg:top-0 lg:h-screen" />

            <div className="relative flex items-start justify-center p-6 md:p-10 lg:col-span-3">
                <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-teal/15 blur-[120px] lg:hidden" />
                <div
                    className={`glass-card relative w-full ${wide ? "max-w-3xl" : "max-w-md"} rounded-3xl p-6 shadow-[0_24px_70px_-30px_rgba(0,0,0,0.4)] md:p-8`}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}
