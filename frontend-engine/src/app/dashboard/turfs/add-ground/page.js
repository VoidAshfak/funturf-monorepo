"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import GroundForm from "@/components/GroundForm";
import { notifyError, notifySuccess } from "@/lib/notify";
import { getApiErrorMessage } from "@/utils/apiError";
import { useCreateGroundMutation } from "@/store/api/apiSlice";

// Add a single ground to the admin's existing turf. A turf_admin owns one turf
// and grows it by adding grounds — the backend scopes the write to their turf.
export default function AddGroundPage() {
    const router = useRouter();
    const [createGround, { isLoading }] = useCreateGroundMutation();

    const handleSubmit = async (payload) => {
        try {
            await createGround(payload).unwrap();
            notifySuccess("Ground added", `${payload.name} is now part of your turf.`);
            router.push("/dashboard/turfs");
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Couldn't add the ground."));
        }
    };

    return (
        <div className="mx-auto max-w-2xl">
            <Link
                href="/dashboard/turfs"
                className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" /> Manage Grounds
            </Link>

            <div className="mb-6">
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground md:text-3xl">
                    Add a ground
                </h1>
                <p className="text-sm text-muted-foreground">
                    Add another playing surface to your turf. Players can book it right away.
                </p>
            </div>

            <GroundForm onSubmit={handleSubmit} submitLabel="Add ground" pending={isLoading} />
        </div>
    );
}
