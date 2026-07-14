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
 * Reading is open to everyone (the thread is social proof that the match is
 * real). Posting is limited to people actually IN the match — the organizer, a
 * co-organizer, or a player whose join request was APPROVED. The server decides
 * that and hands back `can_comment`, so the UI never has to infer it from the
 * participant list and can't drift out of sync with the backend's rule.
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

            {/* composer — or the reason you don't get one */}
            {canComment ? (
                <CommentForm submitting={busy} onSubmit={(text) => handlers.add(text)} />
            ) : (
                <p className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    {!session ? (
                        <>
                            <Link href="/login" className="font-semibold text-primary hover:underline">
                                Sign in
                            </Link>{" "}
                            and join the match to take part in the discussion.
                        </>
                    ) : (
                        "Only players in this match can post. Once your join request is accepted, you can comment here."
                    )}
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
