import { Skeleton } from "@/components/ui/skeleton";
import VenueListSkeleton from "@/components/VenueCardSkeleton";

export default function VenuesLoading() {
    return (
        <div className="relative pb-16">
            {/* banner */}
            <Skeleton className="h-72 w-full rounded-none rounded-b-4xl md:h-80 lg:h-96" />

            {/* filter + grid */}
            <div className="mx-auto -mt-10 max-w-7xl px-4 md:px-8">
                <Skeleton className="h-28 w-full rounded-3xl" />
                <div className="mt-6">
                    <VenueListSkeleton count={6} />
                </div>
            </div>
        </div>
    );
}
