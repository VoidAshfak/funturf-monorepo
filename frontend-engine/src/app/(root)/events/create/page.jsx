import EventCreationForm from "../_components/EventCreationForm";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";

// Full-page match-creation form. The form has many fields, so it gets a real
// page (not a cramped dialog) — comfortable on desktop, scrollable on mobile.
export default function CreateEventPage() {
    return (
        <div className="mx-auto max-w-4xl px-4 pb-24 pt-6 md:px-8 md:pt-24">
            <Link
                href="/events"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" /> Back to matches
            </Link>

            <header className="mb-8 mt-4">
                <span className="glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Host a match
                </span>
                <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
                    Create a{" "}
                    <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent dark:from-brand-light">
                        Match
                    </span>
                </h1>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                    Fill in the details, optionally attach a ground you've already
                    booked, and open it up for players to join.
                </p>
            </header>

            <EventCreationForm />
        </div>
    );
}
