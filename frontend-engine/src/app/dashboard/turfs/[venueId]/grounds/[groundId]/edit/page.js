"use client";

import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import GroundForm from "@/components/GroundForm";
import { notifyError, notifySuccess } from "@/lib/notify";
import { getApiErrorMessage } from "@/utils/apiError";
import { useGetVenueByIdQuery, useUpdateGroundMutation } from "@/store/api/apiSlice";

// Edit one ground's info. Prefilled from the venue payload (public read, so no
// auth race). The PATCH is turf-scoped server-side.
export default function EditGroundPage() {
    const { venueId, groundId } = useParams();
    const router = useRouter();

    const { data: venue, isLoading } = useGetVenueByIdQuery(venueId, { skip: !venueId });
    const [updateGround, { isLoading: saving }] = useUpdateGroundMutation();

    const ground = (venue?.grounds ?? []).find((g) => g.id === groundId);

    const handleSubmit = async (payload) => {
        try {
            await updateGround({ groundId, venueId, ...payload }).unwrap();
            notifySuccess("Ground updated", `${payload.name} was saved.`);
            router.push(`/dashboard/turfs/${venueId}`);
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't save the ground."));
        }
    };

    if (isLoading) {
        return (
            <div className="grid min-h-[50vh] place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    if (!ground) {
        return (
            <div className="mx-auto max-w-md px-4 py-16 text-center">
                <div className="glass-card rounded-3xl p-8">
                    <h1 className="text-xl font-bold text-foreground">Ground not found</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        It may have been removed, or the link is wrong.
                    </p>
                    <Button asChild variant="outline" className="mt-5">
                        <Link href={`/dashboard/turfs/${venueId}`}>Back</Link>
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl">
            <Link
                href={`/dashboard/turfs/${venueId}`}
                className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" /> Back to turf
            </Link>

            <div className="mb-6">
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                    Edit ground info
                </h1>
                <p className="text-sm text-muted-foreground">Update {ground.name}&apos;s details and pricing.</p>
            </div>

            <GroundForm
                initial={ground}
                onSubmit={handleSubmit}
                submitLabel="Save changes"
                pending={saving}
                showStatus
            />
        </div>
    );
}
