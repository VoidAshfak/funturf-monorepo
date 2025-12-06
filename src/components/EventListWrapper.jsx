import { Suspense } from "react";
import EventList from "./EventList";

export default function EventListWrapper() {
    return (
        <Suspense fallback={<p>fetching events</p>}>
            <EventList />
        </Suspense>
    )
}