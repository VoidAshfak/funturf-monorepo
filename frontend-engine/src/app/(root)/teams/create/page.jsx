import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import TeamCreationForm from "../_components/TeamCreationForm";

// Full-page create-team form, matching the match-creation page's shape.
export default function CreateTeamPage() {
    return (
        <div className="mx-auto max-w-4xl px-4 pb-24 pt-6 md:px-8 md:pt-24">
            <Link
                href="/teams"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" /> Back to teams
            </Link>

            <header className="mb-8 mt-4">
                <span className="glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground">
                    <Shield className="h-3.5 w-3.5 text-primary" /> New squad
                </span>
                <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
                    Create a{" "}
                    <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent dark:from-brand-light">
                        Team
                    </span>
                </h1>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                    Name your squad, pick the sport, then invite the players you already
                    call every week. You'll be its captain.
                </p>
            </header>

            <TeamCreationForm />
        </div>
    );
}
