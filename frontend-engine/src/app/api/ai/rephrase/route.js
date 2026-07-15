import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

/**
 * AI rephrase endpoint — turns a user's rough/Banglish blurb into clean text.
 *
 * Why a server route (not a direct client call): the AI API key must NEVER reach
 * the browser. It lives only in server env and is used here. The route is also
 * auth-gated so a stranger can't burn our quota.
 *
 * PROVIDER: Groq by default (`GROQ_API_KEY`) — genuinely free, no card, and (unlike
 * Google's Gemini free tier) available in Bangladesh. Gemini is kept as an optional
 * fallback for anyone whose region/plan supports it. Pick explicitly with
 * `AI_PROVIDER=groq|gemini`, else we auto-pick based on which key is present.
 *
 *   Groq:   GROQ_API_KEY   (get one free at console.groq.com)   GROQ_MODEL?
 *   Gemini: GEMINI_API_KEY (aistudio.google.com)                GEMINI_MODEL?
 */

const MAX_INPUT = 1500; // characters — a description, not an essay

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
// Stable free default. Avoid retired models (gemini-2.5-flash-lite is gone; the
// Gemini free tier itself is region-limited — Groq is the safer default here).
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

// How we want the model to behave, per surface. Kept as a system instruction so
// the user's text can't easily hijack the task (basic prompt-injection hygiene).
const RULES = `The user writes in "Banglish" (Bangla written with English letters) or rough English.
Rewrite it into clear, natural, friendly English.
Rules:
- Preserve the original meaning and any concrete facts (time, place, format, price, facilities). Do NOT invent details.
- Keep it concise: 1-3 short sentences.
- No greetings, no quotes, no markdown, no explanations. Output ONLY the rewritten text.`;

const SYSTEM_INSTRUCTIONS = {
    event: `You are an editor for a sports-match listing app in Bangladesh, polishing a match description.\n${RULES}`,
    venue: `You are an editor for a turf-booking app in Bangladesh, polishing a sports venue (turf) description.\n${RULES}`,
    ground: `You are an editor for a turf-booking app in Bangladesh, polishing a playing-ground description/notes.\n${RULES}`,
};
const systemInstructionFor = (kind) => SYSTEM_INSTRUCTIONS[kind] || SYSTEM_INSTRUCTIONS.event;

// Which provider to use. Explicit env wins; otherwise prefer Groq when its key is
// set, falling back to Gemini.
function pickProvider() {
    const explicit = process.env.AI_PROVIDER?.toLowerCase();
    if (explicit === "groq" || explicit === "gemini") return explicit;
    if (process.env.GROQ_API_KEY) return "groq";
    if (process.env.GEMINI_API_KEY) return "gemini";
    return null; // nothing configured
}

// A tiny error shape the handler knows how to turn into an HTTP response.
class AiError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// fetch with an abort timeout so a slow provider never hangs the UI.
async function fetchWithTimeout(url, options, ms = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// ---- Groq (OpenAI-compatible chat completions) ----
async function callGroq({ system, text }) {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new AiError(503, "AI is not configured. Set GROQ_API_KEY on the server.");

    const res = await fetchWithTimeout("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
                { role: "system", content: system },
                { role: "user", content: text },
            ],
            temperature: 0.7,
            max_tokens: 256,
        }),
    });

    if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error("Groq error", res.status, detail);
        let msg = "";
        try {
            msg = JSON.parse(detail)?.error?.message || "";
        } catch {
            /* non-JSON */
        }
        throw new AiError(502, msg ? `AI service error: ${msg}` : "AI service failed. Try again in a moment.");
    }

    const data = await res.json();
    const out = data?.choices?.[0]?.message?.content?.trim();
    if (!out) throw new AiError(502, "AI returned nothing. Try again.");
    return out;
}

// ---- Gemini (REST generateContent) ----
async function callGemini({ system, text }) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new AiError(503, "AI is not configured. Set GEMINI_API_KEY on the server.");

    const res = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: system }] },
                contents: [{ parts: [{ text }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 256 },
            }),
        }
    );

    if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.error("Gemini error", res.status, detail);
        let msg = "";
        try {
            msg = JSON.parse(detail)?.error?.message || "";
        } catch {
            /* non-JSON */
        }
        throw new AiError(502, msg ? `AI service error: ${msg}` : "AI service failed. Try again in a moment.");
    }

    const data = await res.json();
    const out = data?.candidates?.[0]?.content?.parts
        ?.map((p) => p?.text ?? "")
        .join("")
        .trim();
    if (!out) throw new AiError(502, "AI returned nothing. Try again.");
    return out;
}

export async function POST(req) {
    // Gate: must be logged in (only real users create events/turfs).
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ message: "Sign in to use AI rephrasing." }, { status: 401 });
    }

    const provider = pickProvider();
    if (!provider) {
        return NextResponse.json(
            { message: "AI is not configured. Set GROQ_API_KEY (recommended) on the server." },
            { status: 503 }
        );
    }

    let body;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
    }

    const kind = (body?.kind ?? "event").toString();
    const text = (body?.text ?? "").toString().trim();
    if (!text) {
        return NextResponse.json({ message: "Nothing to rephrase — write something first." }, { status: 400 });
    }
    if (text.length > MAX_INPUT) {
        return NextResponse.json({ message: `Text is too long (max ${MAX_INPUT} characters).` }, { status: 413 });
    }

    const system = systemInstructionFor(kind);

    try {
        const out = provider === "gemini" ? await callGemini({ system, text }) : await callGroq({ system, text });
        return NextResponse.json({ text: out });
    } catch (err) {
        if (err instanceof AiError) {
            return NextResponse.json({ message: err.message }, { status: err.status });
        }
        const msg = err?.name === "AbortError" ? "AI timed out. Try again." : "AI request failed.";
        console.error("rephrase route error", err);
        return NextResponse.json({ message: msg }, { status: 502 });
    }
}
