"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notifyError, notifySuccess } from "@/lib/notify";
import { Loader2, Wand2 } from "lucide-react";
import { useState } from "react";

/**
 * "Rephrase with AI" button — polishes rough/Banglish text in a description box.
 *
 * Reusable across every description field (events, turfs, grounds). It stays dumb:
 * the parent owns the text (via `getText`) and decides what to do with the result
 * (via `onResult`) — so it works with both react-hook-form and plain state.
 *
 * Designed to sit in the bottom-right corner of a `relative` textarea wrapper.
 *
 * @param {() => string} getText   returns the current text to rephrase
 * @param {(text) => void} onResult receives the rephrased text
 * @param {"event"|"venue"|"ground"} [kind] tunes the AI's tone/domain
 */
export default function AiRephraseButton({ getText, onResult, kind = "event", className }) {
    const [loading, setLoading] = useState(false);

    const run = async () => {
        const text = (getText() || "").trim();
        if (!text) {
            notifyError("Write something first, then let AI polish it.");
            return;
        }
        setLoading(true);
        try {
            const res = await fetch("/api/ai/rephrase", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, kind }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.message || "AI rephrasing failed.");
            onResult(json.text);
            notifySuccess("Rephrased.");
        } catch (err) {
            notifyError(err.message || "Couldn't rephrase right now.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={run}
            disabled={loading}
            className={cn(
                "absolute bottom-2 right-2 h-8 gap-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
                className
            )}
        >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {loading ? "Polishing…" : "Rephrase with AI"}
        </Button>
    );
}
