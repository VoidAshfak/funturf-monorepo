import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { Sparkles } from "lucide-react";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserByUserId } from "@/utils/getData";
import ProfileCard from "@/components/ProfileCard";
import ProfileCardSkeleton from "@/components/ProfileCardSkeleton";
import ProfileCover from "@/components/ProfileCover";
import EventListWrapper from "@/components/EventListWrapper";

const UserProfile = async ({ params }) => {
    const { userId } = await params;

    // Is the viewer looking at their OWN profile? Decided server-side from the
    // session, never from a query param — it's what gates every edit affordance.
    // (The API enforces ownership independently; this only controls the UI.)
    const session = await getServerSession(authOptions);
    const isOwner = Boolean(session?.user?.id) && session.user.id === userId;

    // The cover lives outside the Suspense boundary (the banner shouldn't pop in
    // after the card), so it needs its own read. `getUserByUserId` is a plain
    // fetch and Next dedupes it with the one inside ProfileCard.
    const { data: user = {} } = await getUserByUserId(userId);

    return (
        <div className="pb-16">
            {/* banner — editable in place when it's your own profile */}
            <ProfileCover coverUrl={user?.cover_photo_url} isOwner={isOwner} />

            {/* profile card overlapping the banner (flow-based, robust) */}
            <div className="relative z-10 mx-auto -mt-16 max-w-5xl px-4 md:-mt-20 md:px-8">
                <Suspense fallback={<ProfileCardSkeleton />}>
                    <ProfileCard userId={userId} isOwner={isOwner} />
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
