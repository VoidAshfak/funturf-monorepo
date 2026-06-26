import { Suspense } from "react";
import EventList from "./EventList";
import EventListSkeleton from "./EventCardSkeleton";

export default function EventListWrapper({ max }) {
    return (
        <Suspense fallback={<EventListSkeleton count={max || 6} />}>
            <EventList max={max} />
        </Suspense>
    )
}
