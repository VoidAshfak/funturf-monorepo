"use client";

import { useState } from "react";
import { notifyError } from "@/lib/notify";
import { useSession } from "next-auth/react";
import { Check, Clock, Loader2, UserCheck, UserPlus, UserX, X } from "lucide-react";
import { Button } from "./ui/button";
import ConfirmDialog from "./ConfirmDialog";
import { getApiErrorMessage } from "@/utils/apiError";
import {
    useGetConnectionStatusQuery,
    useSendTurfmateRequestMutation,
    useAcceptTurfmateRequestMutation,
    useCancelTurfmateRequestMutation,
    useRemoveTurfmateMutation,
} from "@/store/api/apiSlice";

// Turfmate connect control for a profile. Reflects the live relationship and
// drives the right mutation: send / accept / cancel / remove. Hidden on your
// own profile and when signed out.
export default function ConnectButton({ userId }) {
    const { data: session } = useSession();
    const isSelf = session?.user?.id === userId;
    // Guards the destructive "remove turfmate" action behind a confirm modal.
    const [confirmRemove, setConfirmRemove] = useState(false);

    const { data: conn, isLoading } = useGetConnectionStatusQuery(userId, {
        skip: !session || isSelf,
    });
    const [send, sendState] = useSendTurfmateRequestMutation();
    const [accept, acceptState] = useAcceptTurfmateRequestMutation();
    const [cancel, cancelState] = useCancelTurfmateRequestMutation();
    const [remove, removeState] = useRemoveTurfmateMutation();

    if (!session || isSelf) return null;

    const busy =
        isLoading ||
        sendState.isLoading ||
        acceptState.isLoading ||
        cancelState.isLoading ||
        removeState.isLoading;

    const status = conn?.status ?? "none";
    const direction = conn?.direction;
    const connectionId = conn?.connectionId;

    // Fire a mutation and surface any backend error (e.g. already-exists).
    const run = async (fn, arg) => {
        try {
            await fn(arg).unwrap();
        } catch (err) {
            notifyError(getApiErrorMessage(err, "Something went wrong."));
        }
    };

    const spinner = <Loader2 className="h-4 w-4 animate-spin" />;

    // accepted -> already turfmates. Removing is destructive, so the click only
    // opens a confirm modal; the actual unfriend runs from there.
    if (status === "accepted") {
        return (
            <>
                <Button
                    variant="outline"
                    className="rounded-full"
                    disabled={busy}
                    onClick={() => setConfirmRemove(true)}
                >
                    {busy ? spinner : <UserCheck className="h-4 w-4 text-primary" />}
                    Turfmates
                </Button>
                <ConfirmDialog
                    open={confirmRemove}
                    onOpenChange={setConfirmRemove}
                    Icon={UserX}
                    title="Remove turfmate?"
                    description="You'll both be disconnected. You can always send a new request later."
                    confirmLabel="Remove"
                    cancelLabel="Keep turfmate"
                    // Throw on failure so the modal stays open and the toast shows.
                    onConfirm={async () => {
                        try {
                            await remove(userId).unwrap();
                        } catch (err) {
                            notifyError(getApiErrorMessage(err, "Something went wrong."));
                            throw err;
                        }
                    }}
                />
            </>
        );
    }

    // incoming pending -> I can accept
    if (status === "pending" && direction === "incoming") {
        return (
            <Button
                className="green-glow rounded-full"
                disabled={busy}
                onClick={() => run(accept, connectionId)}
            >
                {busy ? spinner : <Check className="h-4 w-4" />}
                Accept request
            </Button>
        );
    }

    // outgoing pending -> I can cancel
    if (status === "pending" && direction === "outgoing") {
        return (
            <Button
                variant="outline"
                className="rounded-full"
                disabled={busy}
                onClick={() => run(cancel, connectionId)}
            >
                {busy ? spinner : <Clock className="h-4 w-4" />}
                Requested
            </Button>
        );
    }

    // blocked -> no action
    if (status === "blocked") {
        return (
            <Button variant="outline" className="rounded-full" disabled>
                <X className="h-4 w-4" />
                Unavailable
            </Button>
        );
    }

    // none / rejected -> can send a request
    return (
        <Button
            className="green-glow rounded-full"
            disabled={busy}
            onClick={() => run(send, userId)}
        >
            {busy ? spinner : <UserPlus className="h-4 w-4" />}
            Connect
        </Button>
    );
}
