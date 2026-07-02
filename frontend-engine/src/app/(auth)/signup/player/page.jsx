import AuthShell from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/forms/signup-form";

// Player onboarding — registers with user_type "player".
export default function PlayerSignupPage() {
    return (
        <AuthShell wide>
            <SignupForm />
        </AuthShell>
    );
}
