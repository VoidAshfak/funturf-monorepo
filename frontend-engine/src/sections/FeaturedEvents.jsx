import { CalendarDays } from "lucide-react";
import EventListWrapper from "@/components/EventListWrapper";
import SectionShell from "@/components/SectionShell";

export default function FeaturedEvents() {
    return (
        <SectionShell
            tone="match"
            icon={CalendarDays}
            eyebrow="Matches near you"
            title="Discover"
            accent="Games"
            description="Jump into open matches, find a squad, and play this week."
            actionHref="/events"
            actionLabel="See all matches"
        >
            <EventListWrapper max={6} />
        </SectionShell>
    );
}
