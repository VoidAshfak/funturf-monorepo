import { Suspense } from "react";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import ProfileCard from "@/components/ProfileCard";
import ProfileCardSkeleton from "@/components/ProfileCardSkeleton";
import EventListWrapper from "@/components/EventListWrapper";

const UserProfile = async ({ params }) => {
    const { userId } = await params;

    return (
        <div className="pb-16">
            {/* banner */}
            <div className="relative h-64 w-full overflow-hidden md:h-80">
                <Image
                    src="/assets/images/bg3.jpg"
                    alt="Profile banner"
                    fill
                    priority
                    className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
                {/* brand tint */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent mix-blend-overlay" />
            </div>

            {/* profile card overlapping the banner (flow-based, robust) */}
            <div className="relative z-10 mx-auto -mt-16 max-w-5xl px-4 md:-mt-20 md:px-8">
                <Suspense fallback={<ProfileCardSkeleton />}>
                    <ProfileCard userId={userId} />
                </Suspense>
            </div>

            {/* suggested matches */}
            <div className="mx-auto mt-12 max-w-7xl px-4 md:px-8">
                <span className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Get in the game
                </span>
                <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                    Matches you might{" "}
                    <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent dark:from-brand-light">
                        like
                    </span>
                </h2>
                <div className="mt-6">
                    <EventListWrapper max={3} />
                </div>
            </div>
        </div>
    );
};

export default UserProfile;
