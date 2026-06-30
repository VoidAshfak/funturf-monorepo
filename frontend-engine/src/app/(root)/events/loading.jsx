import { Skeleton } from "@/components/ui/skeleton";
import EventListSkeleton from "@/components/EventCardSkeleton";

export default function EventsLoading() {
    return (
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 md:px-8 md:pt-24">
            {/* hero header */}
            <div className="rounded-[2rem] border border-border bg-gradient-to-b from-[#eaf2ee] to-[#e6f1ec] px-6 py-14 dark:from-[#0a1412] dark:to-[#0a0a0a] md:px-12 md:py-16">
                <Skeleton className="h-6 w-44 rounded-full" />
                <Skeleton className="mt-4 h-12 w-72 md:h-16" />
                <Skeleton className="mt-4 h-4 w-80" />
                <div className="mt-6 flex gap-6">
                    <Skeleton className="h-10 w-16" />
                    <Skeleton className="h-10 w-16" />
                    <Skeleton className="h-10 w-16" />
                </div>
            </div>

            {/* filter bar */}
            <Skeleton className="mt-8 h-28 w-full rounded-3xl" />

            {/* grid */}
            <div className="mt-6">
                <EventListSkeleton count={6} />
            </div>
        </div>
    );
}
