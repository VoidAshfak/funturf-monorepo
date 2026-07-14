"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Slim comment composer (Reddit-style).
 *
 * Collapsed it's a single line — no card, no avatar, no button row. It grows
 * into a textarea with actions only once the user actually focuses it, so a
 * thread of twenty comments isn't twenty bulky boxes.
 *
 * Reply/edit forms pass `autoFocus`, so they open already expanded.
 */
export default function CommentForm({
    initialValue = "",
    onSubmit,
    onCancel,
    placeholder = "Add a comment",
    submitLabel = "Comment",
    autoFocus = false,
    submitting = false,
}) {
    const [text, setText] = useState(initialValue);
    // Editing/replying starts open; a fresh composer starts collapsed.
    const [expanded, setExpanded] = useState(autoFocus || Boolean(initialValue));
    const ref = useRef(null);

    const canSend = text.trim().length > 0 && !submitting;

    useEffect(() => {
        if (expanded) ref.current?.focus();
    }, [expanded]);

    const submit = (e) => {
        e?.preventDefault();
        if (!canSend) return;
        onSubmit(text.trim());
        // A new comment clears itself; an edit keeps its text until the parent closes it.
        if (!initialValue) {
            setText("");
            setExpanded(false);
        }
    };

    const cancel = () => {
        setText(initialValue);
        setExpanded(false);
        onCancel?.();
    };

    // Ctrl/Cmd+Enter posts, Escape backs out — no mouse round-trip.
    const onKeyDown = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(e);
        if (e.key === "Escape") cancel();
    };

    return (
        <form onSubmit={submit} className="w-full">
            <textarea
                ref={ref}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setExpanded(true)}
                onKeyDown={onKeyDown}
                rows={expanded ? 3 : 1}
                placeholder={placeholder}
                className={cn(
                    "w-full resize-none rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground focus:border-primary/60",
                    !expanded && "cursor-text overflow-hidden"
                )}
            />

            {/* The action row only exists while you're actually writing. */}
            {expanded && (
                <div className="mt-2 flex items-center justify-end gap-3">
                    <span className="mr-auto hidden text-[11px] text-muted-foreground sm:block">
                        Ctrl+Enter to post
                    </span>
                    <button
                        type="button"
                        onClick={cancel}
                        className="text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={!canSend}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground transition-all hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                        {submitLabel}
                    </button>
                </div>
            )}
        </form>
    );
}
