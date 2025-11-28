import { Suspense } from "react";
import VenueList from "./VenueList";

export default function VenueListWrapper({ max, type }) {
    return (
        <Suspense fallback={<p>fetching venues</p>}>
            <VenueList
                max={max}
                type={type}
            />
        </Suspense>
    )
}