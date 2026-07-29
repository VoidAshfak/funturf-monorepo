import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Reveal from "./Reveal";

/**
 * Shared chrome for the landing page's featured sections (turfs, matches).
 *
 * The two sections were byte-for-byte identical apart from copy, icon and which
 * corner the ambient glows sat in — so the panel, glows, dotted texture, header
 * and the duplicated desktop/mobile "see all" links live here once.
 *
 * Add a new landing section by adding a tone below, not by copying a file.
 */
const TONES = {
    turf: {
        surface: "from-[#eef3ef] to-[#e7f1ea] dark:from-[#0c1410] dark:to-[#0a0a0a]",
        glowA: "-left-24 -top-24 bg-primary/20",
        glowB: "-bottom-28 -right-20 bg-teal/15",
    },
    match: {
        surface: "from-[#eaf2ee] to-[#e6f1ec] dark:from-[#0a1412] dark:to-[#0a0a0a]",
        glowA: "-right-24 -top-24 bg-teal/20",
        glowB: "-bottom-28 -left-20 bg-primary/15",
    },
};

/**
 * The section's outbound link. Rendered twice (inline on >=sm, centred below the
 * grid on mobile) because the two positions are genuinely different layouts, not
 * one element moving.
 */
function SectionAction({ href, label, className = "" }) {
    return (
        <Link
            href={href}
            className={cn(
                // min-h-12 (48px) keeps it a legal touch target at every size —
                // DESIGN.md treats that as non-negotiable.
                "group inline-flex min-h-12 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 text-sm font-semibold text-primary backdrop-blur-md transition-all duration-200 hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_28px_rgba(29,185,84,0.45)] active:scale-[0.97] active:duration-75 motion-reduce:transition-none motion-reduce:active:scale-100",
                className
            )}
        >
            {label}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
        </Link>
    );
}

export default function SectionShell({
    tone = "turf",
    icon: Icon,
    eyebrow,
    title,
    accent,
    description,
    actionHref,
    actionLabel,
    children,
}) {
    const t = TONES[tone] ?? TONES.turf;

    return (
        <section
            className={cn(
                "relative isolate overflow-hidden rounded-[2rem] border border-border bg-gradient-to-b px-5 py-12 md:px-10 md:py-16",
                t.surface
            )}
        >
            {/* Ambient glows — decorative depth behind the glass cards. */}
            <div
                className={cn(
                    "pointer-events-none absolute h-80 w-80 rounded-full blur-[120px]",
                    t.glowA
                )}
            />
            <div
                className={cn(
                    "pointer-events-none absolute h-80 w-80 rounded-full blur-[120px]",
                    t.glowB
                )}
            />

            {/* Dotted turf texture, masked to fade out at the panel edges. */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.18] dark:opacity-[0.12]"
                style={{
                    backgroundImage:
                        "radial-gradient(rgba(29,185,84,0.5) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                    maskImage:
                        "radial-gradient(ellipse at center, black, transparent 75%)",
                    WebkitMaskImage:
                        "radial-gradient(ellipse at center, black, transparent 75%)",
                }}
            />

            <Reveal className="relative mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <span className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                        {Icon ? <Icon className="h-3.5 w-3.5 text-primary" /> : null}
                        {eyebrow}
                    </span>

                    {/*
                        Tracking is size-specific, not one fixed value: type reads
                        progressively too loose as it grows, so the heading tightens
                        at the larger breakpoint while the body copy below stays at
                        the font's natural tracking.
                    */}
                    <h2 className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-[-0.015em] text-foreground md:text-4xl md:leading-[1.1] md:tracking-[-0.025em]">
                        {title}{" "}
                        <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent dark:from-brand-light">
                            {accent}
                        </span>
                    </h2>

                    <p className="mt-2 max-w-md text-base leading-7 text-muted-foreground">
                        {description}
                    </p>
                </div>

                <SectionAction
                    href={actionHref}
                    label={actionLabel}
                    className="hidden sm:inline-flex"
                />
            </Reveal>

            <div className="relative">{children}</div>

            <div className="relative mt-10 flex justify-center sm:hidden">
                <SectionAction href={actionHref} label={actionLabel} />
            </div>
        </section>
    );
}
