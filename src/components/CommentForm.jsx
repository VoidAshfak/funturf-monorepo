'use client';
import { useState } from 'react';

export default function CommentForm({ initialValue = '', onSubmit, onCancel }) {
    const [text, setText] = useState(initialValue);
    return (
        <form
            className="space-y-2"
            onSubmit={e => {
                e.preventDefault();
                if (text.trim()) onSubmit(text);
            }}
        >
            <textarea
                className="w-full border border-border bg-transparent text-foreground rounded p-2"
                rows={3}
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Write a comment..."
            />
            <div className="flex space-x-2">
                <button
                    type="submit"
                    className="px-4 py-1 bg-primary text-primary-foreground rounded hover:bg-brand-light"
                >
                    {initialValue ? 'Save' : 'Post'}
                </button>

                {onCancel && (
                    <button
                        type="button"
                        className="px-4 py-1 border border-border rounded hover:bg-accent"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
}
