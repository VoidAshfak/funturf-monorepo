import { Skeleton } from "@/components/ui/skeleton"

export default function ProfileCardSkeleton() {
    return (
        <div className="glass-card rounded-3xl p-6 md:p-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start">
                <Skeleton className="-mt-24 h-32 w-32 shrink-0 self-center rounded-full md:-mt-28 md:h-36 md:w-36 md:self-start" />
                <div className="flex-1 space-y-4">
                    <div className="flex flex-col items-center gap-3 md:flex-row md:justify-between">
                        <div className="space-y-2">
                            <Skeleton className="h-7 w-48" />
                            <Skeleton className="h-4 w-28" />
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-9 w-28 rounded-full" />
                            <Skeleton className="h-9 w-28 rounded-full" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <Skeleton className="h-16 rounded-2xl" />
                        <Skeleton className="h-16 rounded-2xl" />
                        <Skeleton className="h-16 rounded-2xl" />
                    </div>
                </div>
            </div>
            <Skeleton className="mt-6 h-4 w-3/4" />
        </div>
    )
}
