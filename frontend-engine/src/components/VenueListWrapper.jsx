import { Suspense } from "react";
import VenueList from "./VenueList";
import VenueListSkeleton from "./VenueCardSkeleton";

export default function VenueListWrapper({ max, type }) {
    return (
        <Suspense fallback={<VenueListSkeleton count={max || 6} />}>
            <VenueList
                max={max}
                type={type}
            />
        </Suspense>
    )
}
