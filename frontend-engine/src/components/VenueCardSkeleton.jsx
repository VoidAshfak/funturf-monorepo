import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Loading placeholder shaped like VenueCard.
export function VenueCardSkeleton() {
    return (
        <Card className="gap-0 overflow-hidden rounded-3xl p-0">
            {/* media */}
            <Skeleton className="h-52 w-full rounded-none" />
            {/* body */}
            <div className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
                <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            </div>
        </Card>
    );
}

// Grid of venue skeletons — mirrors VenueGrid layout.
export default function VenueListSkeleton({ count = 6 }) {
    return (
        <div className="grid grid-cols-1 gap-5 py-10 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }).map((_, i) => (
                <VenueCardSkeleton key={i} />
            ))}
        </div>
    );
}
