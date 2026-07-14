"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Heart, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import CommentForm from "./CommentForm";

const fullName = (u) =>
    [u?.first_name, u?.last_name].filter(Boolean).join(" ") || "Player";

const timeAgo = (date) => {
    try {
        return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
        return "";
    }
};

/**
 * One comment in the thread — Reddit-slim.
 *
 * No card, no glass panel: an avatar, a byline, the text, and a row of small
 * muted text actions. Replies hang off a left rule instead of a nested box, so
 * depth costs 12px rather than a whole new frame.
 *
 * Threading is one level deep (the API re-parents deeper replies onto the root),
 * so `replies` is always a flat list.
 */
export default function CommentItem({
    comment,
    me,
    canComment,
    isEventAdmin,
    handlers,
    isReply = false,
    busy = false,
}) {
    const [replying, setReplying] = useState(false);
    const [editing, setEditing] = useState(false);

    const isAuthor = me && comment.user_id === me;
    // An admin may remove any comment (moderation); only the author may edit one.
    const canDelete = isAuthor || isEventAdmin;

    // Soft-deleted comments stay in the tree so their replies keep a parent.
    if (comment.is_deleted) {
        return (
            <div className={cn(isReply && "border-l border-border/60 pl-4")}>
                <p className="py-2 text-xs italic text-muted-foreground">[comment removed]</p>
                {comment.replies?.map((child) => (
                    <CommentItem
                        key={child.id}
                        comment={child}
                        me={me}
                        canComment={canComment}
                        isEventAdmin={isEventAdmin}
                        handlers={handlers}
                        busy={busy}
                        isReply
                    />
                ))}
            </div>
        );
    }

    return (
        <div className={cn(isReply && "border-l border-border/60 pl-4")}>
            <div className="flex gap-2.5 py-2">
                <Avatar className="h-6 w-6 shrink-0">
                    <AvatarImage
                        src={comment.author?.profile_picture_url || undefined}
                        alt={fullName(comment.author)}
                    />
                    <AvatarFallback>
                        <User className="h-3 w-3" />
                    </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                    {/* byline */}
                    <div className="flex flex-wrap items-center gap-x-1.5 text-xs">
                        <span className="font-bold text-foreground">{fullName(comment.author)}</span>
                        <span className="text-muted-foreground">· {timeAgo(comment.created_at)}</span>
                        {comment.is_edited && (
                            <span className="text-muted-foreground">· edited</span>
                        )}
                    </div>

                    {editing ? (
                        <div className="mt-1.5">
                            <CommentForm
                                initialValue={comment.content}
                                submitLabel="Save"
                                submitting={busy}
                                autoFocus
                                onSubmit={(text) => {
                                    handlers.edit(comment.id, text);
                                    setEditing(false);
                                }}
                                onCancel={() => setEditing(false)}
                            />
                        </div>
                    ) : (
                        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                            {comment.content}
                        </p>
                    )}

                    {/* actions — plain text, not buttons */}
                    {!editing && (
                        <div className="mt-1 flex items-center gap-3 text-xs font-semibold">
                            <button
                                onClick={() => handlers.like(comment.id)}
                                disabled={!canComment}
                                title={canComment ? undefined : "Join the match to react"}
                                className={cn(
                                    "inline-flex items-center gap-1 transition-colors",
                                    comment.liked_by_me
                                        ? "text-primary"
                                        : "text-muted-foreground hover:text-foreground",
                                    !canComment && "cursor-not-allowed opacity-50"
                                )}
                            >
                                <Heart
                                    className={cn("h-3.5 w-3.5", comment.liked_by_me && "fill-current")}
                                />
                                {comment.likes_count > 0 && comment.likes_count}
                            </button>

                            {/* Only players can reply — same gate as posting. */}
                            {canComment && (
                                <button
                                    onClick={() => setReplying((v) => !v)}
                                    className="text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    Reply
                                </button>
                            )}

                            {isAuthor && (
                                <button
                                    onClick={() => setEditing(true)}
                                    className="text-muted-foreground transition-colors hover:text-foreground"
                                >
                                    Edit
                                </button>
                            )}
                            {canDelete && (
                                <button
                                    onClick={() => handlers.remove(comment.id)}
                                    className="text-muted-foreground transition-colors hover:text-destructive"
                                >
                                    Delete
                                </button>
                            )}
                        </div>
                    )}

                    {/* reply composer */}
                    {replying && (
                        <div className="mt-2">
                            <CommentForm
                                placeholder={`Reply to ${fullName(comment.author)}`}
                                submitLabel="Reply"
                                submitting={busy}
                                autoFocus
                                onSubmit={(text) => {
                                    // Replying to a reply attaches to the same root (one level deep).
                                    handlers.add(text, comment.parent_comment_id ?? comment.id);
                                    setReplying(false);
                                }}
                                onCancel={() => setReplying(false)}
                            />
                        </div>
                    )}
                </div>
            </div>

            {comment.replies?.map((child) => (
                <CommentItem
                    key={child.id}
                    comment={child}
                    me={me}
                    canComment={canComment}
                    isEventAdmin={isEventAdmin}
                    handlers={handlers}
                    busy={busy}
                    isReply
                />
            ))}
        </div>
    );
}
