import { getAllEvents } from "@/utils/getData";
import EmptyState from "./EmptyState";
import EventCard from "./EventCard";
import Link from "next/link";
import CardGrid from "./CardGrid";

export default async function EventList({ max }) {
    // GET /events is paginated now: data = { events, pagination, stats }.
    // These non-feed usages (featured/profile/related) just want the first N.
    const { data } = await getAllEvents(max ? { limit: max } : {});
    const events = data?.events ?? [];

    if (!events || events.length === 0) {
        return (
            <EmptyState
                title="No Event Yet"
            />
        );
    }

    const finalEvents = max ? events.slice(0, max) : events;

    return (
        <CardGrid>
            {finalEvents.map(event => (
                <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="grid-card"
                >
                    <EventCard event={event} />
                </Link>
            ))}
        </CardGrid>
    )
}