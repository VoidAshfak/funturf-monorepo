'use client';
import { useState } from 'react';
import { Send, X } from 'lucide-react';

export default function CommentForm({
    initialValue = '',
    currentUser,
    onSubmit,
    onCancel,
    placeholder = 'Write a comment…',
    compact = false,
}) {
    const [text, setText] = useState(initialValue);
    const canSend = text.trim().length > 0;

    const submit = (e) => {
        e.preventDefault();
        if (!canSend) return;
        onSubmit(text.trim());
        if (!initialValue) setText('');
    };

    return (
        <form
            onSubmit={submit}
            className="glass-neutral flex gap-3 rounded-2xl border border-border/60 p-3"
        >
            {!compact && currentUser?.avatar && (
                <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-primary/20"
                />
            )}
            <div className="flex-1 space-y-2">
                <textarea
                    className="w-full resize-none rounded-xl border border-border bg-background/60 p-3 text-sm text-foreground outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                    rows={compact ? 2 : 3}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={placeholder}
                />
                <div className="flex items-center justify-end gap-2">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
                        >
                            <X className="h-3.5 w-3.5" />
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={!canSend}
                        className="green-glow inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-1.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                    >
                        <Send className="h-3.5 w-3.5" />
                        {initialValue ? 'Save' : 'Post'}
                    </button>
                </div>
            </div>
        </form>
    );
}
