'use client';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Pencil, Trash2 } from 'lucide-react';
import CommentForm from './CommentForm';

export default function CommentItem({ comment, currentUser, handlers, depth = 0 }) {
    const [isReplying, setReplying] = useState(false);
    const [isEditing, setEditing] = useState(false);

    const isAuthor = currentUser.id === comment.author.id;
    const hasLiked = comment.likes.includes(currentUser.id);

    const timeAgo = (() => {
        try {
            return formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true });
        } catch {
            return '';
        }
    })();

    return (
        <div
            className={
                depth
                    ? 'mt-4 border-l-2 border-border/70 pl-4 sm:pl-5'
                    : ''
            }
        >
            <div className="glass-neutral rounded-2xl border border-border/60 p-4">
                <div className="flex items-start gap-3">
                    <img
                        src={comment.author.avatar}
                        alt={comment.author.name}
                        className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
                    />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                                {comment.author.name}
                            </span>
                            <span className="text-xs text-muted-foreground">· {timeAgo}</span>
                        </div>

                        {isEditing ? (
                            <div className="mt-2">
                                <CommentForm
                                    currentUser={currentUser}
                                    initialValue={comment.content}
                                    onSubmit={(text) => {
                                        handlers.editComment(comment._id, text);
                                        setEditing(false);
                                    }}
                                    onCancel={() => setEditing(false)}
                                    compact
                                />
                            </div>
                        ) : (
                            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground/90">
                                {comment.content}
                            </p>
                        )}

                        {!isEditing && (
                            <div className="mt-3 flex items-center gap-1">
                                <button
                                    onClick={() => handlers.toggleLike(comment._id)}
                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                                        hasLiked
                                            ? 'bg-primary/15 text-primary'
                                            : 'text-muted-foreground hover:bg-muted'
                                    }`}
                                >
                                    <Heart
                                        className={`h-3.5 w-3.5 ${hasLiked ? 'fill-current' : ''}`}
                                    />
                                    {comment.likes.length > 0 && comment.likes.length}
                                </button>

                                <button
                                    onClick={() => setReplying((v) => !v)}
                                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
                                >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                    Reply
                                </button>

                                {isAuthor && (
                                    <>
                                        <button
                                            onClick={() => setEditing(true)}
                                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handlers.deleteComment(comment._id)}
                                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Reply form */}
            {isReplying && (
                <div className="mt-3 pl-4 sm:pl-5">
                    <CommentForm
                        currentUser={currentUser}
                        placeholder={`Reply to ${comment.author.name}…`}
                        onSubmit={(content) => {
                            handlers.addComment(content, comment._id);
                            setReplying(false);
                        }}
                        onCancel={() => setReplying(false)}
                        compact
                    />
                </div>
            )}

            {/* Nested replies */}
            {comment.replies.map((child) => (
                <CommentItem
                    key={child._id}
                    comment={child}
                    currentUser={currentUser}
                    handlers={handlers}
                    depth={depth + 1}
                />
            ))}
        </div>
    );
}
