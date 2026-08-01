import AuthShell from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/forms/signup-form";

// Player onboarding — registers with user_type "player".
// `?email=` arrives from the forgot-password redirect (unknown address) via the
// signup chooser; read here on the server so the form needs no <Suspense>.
export default async function PlayerSignupPage({ searchParams }) {
    const { email } = (await searchParams) ?? {};

    return (
        <AuthShell wide>
            <SignupForm defaultEmail={typeof email === "string" ? email : ""} />
        </AuthShell>
    );
}
