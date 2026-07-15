"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";

// A small, dependency-free emoji picker. A curated set covers chat + sports
// reactions without pulling in a heavy emoji library. Reused for the composer
// (insert into text) and for reacting to a message.
const EMOJIS = [
    "😀", "😂", "🤣", "😊", "😍", "😎", "😅", "🙌",
    "👍", "👎", "🔥", "⚽", "🏏", "🏀", "🎾", "🏆",
    "💪", "🙏", "👏", "🎉", "❤️", "💯", "😭", "😤",
    "😴", "🤝", "👀", "✅", "❌", "⏰", "📍", "😉",
    "😮", "🥳", "😢", "🤔", "🫡", "🤙", "☝️", "🙈",
];

export default function EmojiPicker({ onSelect, trigger, align = "end", side = "top" }) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent align={align} side={side} className="w-64 p-2">
                <div className="grid grid-cols-8 gap-1">
                    {EMOJIS.map((e) => (
                        <button
                            key={e}
                            type="button"
                            onClick={() => {
                                onSelect(e);
                                setOpen(false);
                            }}
                            className="rounded-md p-1 text-xl leading-none transition-colors hover:bg-accent"
                        >
                            {e}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}
