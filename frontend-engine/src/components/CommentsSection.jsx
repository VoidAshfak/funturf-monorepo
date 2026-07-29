"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Loader2, Lock, MessageSquare } from "lucide-react";
import { getApiErrorMessage } from "@/utils/apiError";
import { notifyError, notifySuccess } from "@/lib/notify";
import {
    useGetCommentsQuery,
    useCreateCommentMutation,
    useUpdateCommentMutation,
    useDeleteCommentMutation,
    useToggleCommentLikeMutation,
} from "@/store/api/apiSlice";
import CommentItem from "./CommentItem";
import CommentForm from "./CommentForm";

/**
 * Event discussion.
 *
 * Reading is open to everyone. Any signed-in user may post, reply, or like
 * comments — the old squad-only gate was removed.
 */
export default function CommentsSection({ eventId, isEventAdmin = false }) {
    const { data: session } = useSession();
    const me = session?.user?.id;

    const { data, isLoading } = useGetCommentsQuery(eventId, { skip: !eventId });
    const comments = useMemo(() => data?.comments ?? [], [data?.comments]);
    const canComment = Boolean(data?.can_comment);

    const [create, createState] = useCreateCommentMutation();
    const [update, updateState] = useUpdateCommentMutation();
    const [remove, removeState] = useDeleteCommentMutation();
    const [like] = useToggleCommentLikeMutation();
    const busy = createState.isLoading || updateState.isLoading || removeState.isLoading;

    // The API returns a flat list; nest it once for rendering (one level deep).
    const tree = useMemo(() => buildTree(comments), [comments]);

    const handlers = {
        add: async (content, parent_comment_id = null) => {
            try {
                await create({ eventId, content, parent_comment_id }).unwrap();
                notifySuccess(parent_comment_id ? "Reply posted" : "Comment posted");
            } catch (err) {
                notifyError(getApiErrorMessage(err, "Could not post your comment."));
            }
        },
        edit: async (commentId, content) => {
            try {
                await update({ eventId, commentId, content }).unwrap();
            } catch (err) {
                notifyError(getApiErrorMessage(err, "Could not save your edit."));
            }
        },
        remove: async (commentId) => {
            if (!confirm("Delete this comment?")) return;
            try {
                await remove({ eventId, commentId }).unwrap();
            } catch (err) {
                notifyError(getApiErrorMessage(err, "Could not delete the comment."));
            }
        },
        like: async (commentId) => {
            try {
                // Optimistic in the api slice — it rolls itself back on failure.
                await like({ eventId, commentId }).unwrap();
            } catch (err) {
                notifyError(getApiErrorMessage(err, "Could not react to that."));
            }
        },
    };

    return (
        <div className="space-y-4">
            {/* header */}
            <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
                    Discussion
                </h3>
                <span className="text-sm font-semibold text-muted-foreground">
                    {comments.length}
                </span>
            </div>

            {/* composer — or prompt to sign in */}
            {canComment ? (
                <CommentForm submitting={busy} onSubmit={(text) => handlers.add(text)} />
            ) : (
                <p className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    <Link href="/login" className="font-semibold text-primary hover:underline">
                        Sign in
                    </Link>{" "}
                    to join the discussion.
                </p>
            )}

            {/* thread */}
            {isLoading ? (
                <div className="flex justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
            ) : tree.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                    No comments yet.
                </p>
            ) : (
                <div className="divide-y divide-border/50">
                    {tree.map((c) => (
                        <CommentItem
                            key={c.id}
                            comment={c}
                            me={me}
                            canComment={canComment}
                            isEventAdmin={isEventAdmin}
                            handlers={handlers}
                            busy={busy}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

/** Flat list -> one-level tree (roots with their replies attached, oldest first). */
function buildTree(list) {
    const byId = new Map();
    const roots = [];

    for (const c of list) byId.set(c.id, { ...c, replies: [] });
    for (const c of list) {
        const node = byId.get(c.id);
        if (c.parent_comment_id) byId.get(c.parent_comment_id)?.replies.push(node);
        else roots.push(node);
    }
    return roots;
}
