import { Suspense } from "react";
import EventList from "./EventList";
import EventListSkeleton from "./EventCardSkeleton";

export default function EventListWrapper() {
    return (
        <Suspense fallback={<EventListSkeleton count={6} />}>
            <EventList />
        </Suspense>
    )
}
