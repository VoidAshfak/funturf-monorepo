"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
    Sparkles,
    Users,
    UserCheck,
    UserPlus,
    UserX,
    Check,
    X,
    MapPin,
    Clock,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    useGetTurfmatesQuery,
    useGetTurfmateRequestsQuery,
    useGetOutgoingRequestsQuery,
    useGetTurfmateRecommendationsQuery,
    useAcceptTurfmateRequestMutation,
    useRejectTurfmateRequestMutation,
    useCancelTurfmateRequestMutation,
    useRemoveTurfmateMutation,
    useSendTurfmateRequestMutation,
} from "@/store/api/apiSlice";
import EmptyState from "@/components/EmptyState";
import ConfirmDialog from "@/components/ConfirmDialog";
import { notifyError } from "@/lib/notify";
import { getApiErrorMessage } from "@/utils/apiError";

const fullName = (u) =>
    [u?.first_name, u?.last_name].filter(Boolean).join(" ") || "Player";
const areaOf = (u) => [u?.district, u?.division].filter(Boolean).join(", ");
const initials = (name = "") =>
    name.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join("").toUpperCase() || "?";

export default function TurfmatesPage() {
    const { data: session, status } = useSession();

    const skip = !session;
    const turfmatesQ = useGetTurfmatesQuery(undefined, { skip });
    const incomingQ = useGetTurfmateRequestsQuery(undefined, { skip });
    const outgoingQ = useGetOutgoingRequestsQuery(undefined, { skip });
    const recsQ = useGetTurfmateRecommendationsQuery(undefined, { skip });

    if (status === "loading") return null;

    if (!session) {
        return (
            <div className="mx-auto max-w-3xl px-4 pb-16 pt-28 md:px-8">
                <EmptyState
                    Icon={Users}
                    title="Sign in to see your turfmates"
                    description="Connect with players, grow your squad, and get recommendations near you."
                />
                <div className="mt-6 flex justify-center">
                    <Button asChild className="green-glow rounded-full">
                        <Link href="/login">Log in</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const turfmates = turfmatesQ.data?.turfmates ?? [];
    const incoming = incomingQ.data?.requests ?? [];
    const outgoing = outgoingQ.data?.requests ?? [];
    const recs = recsQ.data ?? [];
    const requestCount = incoming.length + outgoing.length;

    return (
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 md:px-8 md:pt-24">
            {/* header */}
            <div className="mb-8">
                <span className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    Your network
                </span>
                <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground md:text-5xl">
                    Turfmates
                </h1>
                <p className="mt-2 max-w-md text-muted-foreground">
                    Build your squad — connect with players near you and never be short a person again.
                </p>
            </div>

            <Tabs defaultValue="turfmates">
                <TabsList className="mb-6">
                    <TabsTrigger value="turfmates">
                        My Turfmates
                        <Count n={turfmates.length} />
                    </TabsTrigger>
                    <TabsTrigger value="requests">
                        Requests
                        <Count n={requestCount} highlight={incoming.length > 0} />
                    </TabsTrigger>
                    <TabsTrigger value="discover">
                        <Sparkles className="mr-1 h-3.5 w-3.5" />
                        Discover
                    </TabsTrigger>
                </TabsList>

                {/* My Turfmates */}
                <TabsContent value="turfmates">
                    {turfmatesQ.isLoading ? (
                        <ListSkeleton />
                    ) : turfmates.length === 0 ? (
                        <EmptyState
                            Icon={Users}
                            title="No turfmates yet"
                            description="Head to Discover to find players near you."
                        />
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {turfmates.map((t) => (
                                <TurfmateCard key={t.id} person={t} />
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Requests */}
                <TabsContent value="requests">
                    <section className="space-y-6">
                        <div>
                            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                Incoming
                            </h2>
                            {incomingQ.isLoading ? (
                                <ListSkeleton />
                            ) : incoming.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No incoming requests.</p>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {incoming.map((r) => (
                                        <IncomingCard key={r.connectionId} request={r} />
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                Sent
                            </h2>
                            {outgoingQ.isLoading ? (
                                <ListSkeleton />
                            ) : outgoing.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No pending sent requests.</p>
                            ) : (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {outgoing.map((r) => (
                                        <OutgoingCard key={r.connectionId} request={r} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                </TabsContent>

                {/* Discover / recommendations */}
                <TabsContent value="discover">
                    {recsQ.isLoading ? (
                        <ListSkeleton />
                    ) : recs.length === 0 ? (
                        <EmptyState
                            Icon={Sparkles}
                            title="No recommendations yet"
                            description="Join or organize a match to help us find players in your area."
                        />
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {recs.map((p) => (
                                <RecommendationCard key={p.id} person={p} />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}

function Count({ n, highlight }) {
    if (!n) return null;
    return (
        <span
            className={`ml-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold ${
                highlight ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
        >
            {n}
        </span>
    );
}

// Shared avatar + identity block.
function PersonHeader({ person, sub }) {
    const name = fullName(person);
    return (
        <Link href={`/profile/${person.id}`} className="flex min-w-0 items-center gap-3">
            <Avatar className="h-11 w-11">
                <AvatarImage src={person.profile_picture_url} alt={name} />
                <AvatarFallback>{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">{name}</p>
                {sub}
            </div>
        </Link>
    );
}

function AreaLine({ person }) {
    const area = areaOf(person);
    if (!area) return null;
    return (
        <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 text-primary" />
            {area}
        </span>
    );
}

function CardShell({ children, highlight }) {
    return (
        <div
            className={`glass-card flex items-center justify-between gap-3 rounded-2xl border border-border p-3 ${
                highlight ? "ring-1 ring-primary/40" : ""
            }`}
        >
            {children}
        </div>
    );
}

function TurfmateCard({ person }) {
    const [remove, { isLoading }] = useRemoveTurfmateMutation();
    // Removing a turfmate is destructive -> confirm before it fires.
    const [confirmOpen, setConfirmOpen] = useState(false);
    return (
        <CardShell>
            <PersonHeader person={person} sub={<AreaLine person={person} />} />
            <Button
                variant="outline"
                size="sm"
                className="shrink-0 rounded-full"
                disabled={isLoading}
                onClick={() => setConfirmOpen(true)}
            >
                <UserX className="h-4 w-4" />
                Remove
            </Button>
            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                Icon={UserX}
                title={`Remove ${fullName(person)}?`}
                description="You'll both be disconnected. You can always send a new request later."
                confirmLabel="Remove"
                cancelLabel="Keep turfmate"
                onConfirm={async () => {
                    try {
                        await remove(person.id).unwrap();
                    } catch (err) {
                        notifyError(getApiErrorMessage(err, "Something went wrong."));
                        throw err; // keep the modal open on failure
                    }
                }}
            />
        </CardShell>
    );
}

function IncomingCard({ request }) {
    const person = request.user;
    const [accept, { isLoading: accepting }] = useAcceptTurfmateRequestMutation();
    const [reject, { isLoading: rejecting }] = useRejectTurfmateRequestMutation();
    return (
        <CardShell highlight>
            <PersonHeader person={person} sub={<AreaLine person={person} />} />
            <div className="flex shrink-0 gap-2">
                <Button
                    size="sm"
                    className="green-glow rounded-full"
                    disabled={accepting}
                    onClick={() => accept(request.connectionId)}
                >
                    <Check className="h-4 w-4" />
                    Accept
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={rejecting}
                    onClick={() => reject(request.connectionId)}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </CardShell>
    );
}

function OutgoingCard({ request }) {
    const person = request.user;
    const [cancel, { isLoading }] = useCancelTurfmateRequestMutation();
    return (
        <CardShell>
            <PersonHeader
                person={person}
                sub={
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Pending
                    </span>
                }
            />
            <Button
                variant="outline"
                size="sm"
                className="shrink-0 rounded-full"
                disabled={isLoading}
                onClick={() => cancel(request.connectionId)}
            >
                Cancel
            </Button>
        </CardShell>
    );
}

function RecommendationCard({ person }) {
    const [send, { isLoading, isSuccess }] = useSendTurfmateRequestMutation();
    return (
        <CardShell highlight={person.has_mutual}>
            <PersonHeader
                person={person}
                sub={
                    <span className="flex flex-col gap-0.5">
                        <AreaLine person={person} />
                        {person.reason && (
                            <span
                                className={`truncate text-xs font-medium ${
                                    person.has_mutual ? "text-primary" : "text-muted-foreground"
                                }`}
                            >
                                {person.has_mutual && <UserCheck className="mr-1 inline h-3 w-3" />}
                                {person.reason}
                            </span>
                        )}
                    </span>
                }
            />
            <Button
                size="sm"
                className="shrink-0 rounded-full"
                variant={isSuccess ? "outline" : "default"}
                disabled={isLoading || isSuccess}
                onClick={() => send(person.id)}
            >
                {isSuccess ? (
                    <>
                        <Check className="h-4 w-4" />
                        Sent
                    </>
                ) : (
                    <>
                        <UserPlus className="h-4 w-4" />
                        Connect
                    </>
                )}
            </Button>
        </CardShell>
    );
}

function ListSkeleton() {
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[72px] animate-pulse rounded-2xl border border-border bg-card/50" />
            ))}
        </div>
    );
}
