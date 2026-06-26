import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Loading placeholder shaped like EventCard.
export function EventCardSkeleton() {
    return (
        <Card className="gap-0 overflow-hidden rounded-3xl p-0">
            {/* poster hero */}
            <div className="relative h-36 border-b border-primary/15 bg-primary/5 p-4">
                <Skeleton className="h-6 w-24 rounded-full" />
                <div className="absolute right-4 top-4 space-y-1.5 text-right">
                    <Skeleton className="ml-auto h-7 w-10" />
                    <Skeleton className="ml-auto h-3 w-16" />
                </div>
                <Skeleton className="absolute inset-x-4 bottom-3 h-6 w-2/3" />
            </div>

            {/* body */}
            <div className="flex flex-col gap-4 p-5">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                {/* progress */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-24" />
                        <Skeleton className="h-3 w-10" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                </div>
                {/* footer */}
                <div className="flex items-center justify-between border-t border-border pt-4">
                    <Skeleton className="h-8 w-24 rounded-full" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                </div>
            </div>
        </Card>
    );
}

// Grid of event skeletons — mirrors EventList layout (max 3 columns).
export default function EventListSkeleton({ count = 6 }) {
    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: count }).map((_, i) => (
                <EventCardSkeleton key={i} />
            ))}
        </div>
    );
}
