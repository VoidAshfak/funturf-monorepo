import { Skeleton } from "@/components/ui/skeleton";

export default function TeamsLoading() {
    return (
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 md:px-8 md:pt-24">
            {/* header */}
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <Skeleton className="h-6 w-36 rounded-full" />
                    <Skeleton className="mt-4 h-12 w-52 md:h-16" />
                    <Skeleton className="mt-4 h-4 w-80" />
                </div>
                <Skeleton className="h-10 w-40 rounded-full" />
            </div>

            {/* tabs */}
            <Skeleton className="mb-6 h-10 w-56 rounded-xl" />

            {/* team cards */}
            <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-[72px] rounded-2xl" />
                ))}
            </div>
        </div>
    );
}
