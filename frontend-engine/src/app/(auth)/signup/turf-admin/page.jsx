import AuthShell from "@/components/auth/AuthShell";
import { TurfAdminSignupForm } from "@/components/forms/turf-admin-signup-form";

// Turf owner onboarding step 1 — creates a user_type "turf_admin" account.
// Venue details are collected afterwards in the turf-creation wizard.
// `?email=` arrives from the forgot-password redirect (unknown address) via the
// signup chooser; read here on the server so the form needs no <Suspense>.
export default async function TurfAdminSignupPage({ searchParams }) {
    const { email } = (await searchParams) ?? {};

    return (
        <AuthShell wide>
            <TurfAdminSignupForm defaultEmail={typeof email === "string" ? email : ""} />
        </AuthShell>
    );
}
