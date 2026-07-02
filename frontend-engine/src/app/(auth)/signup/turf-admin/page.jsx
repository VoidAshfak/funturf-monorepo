import AuthShell from "@/components/auth/AuthShell";
import { TurfAdminSignupForm } from "@/components/forms/turf-admin-signup-form";

// Turf owner onboarding step 1 — creates a user_type "turf_admin" account.
// Venue details are collected afterwards in the turf-creation wizard.
export default function TurfAdminSignupPage() {
    return (
        <AuthShell wide>
            <TurfAdminSignupForm />
        </AuthShell>
    );
}
