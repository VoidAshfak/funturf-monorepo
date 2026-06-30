import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import VenueListWrapper from "@/components/VenueListWrapper";

function SeeAllTurfs({ className = "" }) {
    return (
        <Link
            href="/venues"
            className={`group inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary backdrop-blur-md transition-all duration-300 hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_28px_rgba(29,185,84,0.45)] ${className}`}
        >
            See all turfs
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
    );
}

const FeaturedTurfs = () => {
    return (
        <section className="relative isolate overflow-hidden rounded-[2rem] border border-border bg-gradient-to-b from-[#eef3ef] to-[#e7f1ea] px-5 py-12 dark:from-[#0c1410] dark:to-[#0a0a0a] md:px-10 md:py-16">
            {/* ambient glows */}
            <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-primary/20 blur-[120px]" />
            <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-teal/15 blur-[120px]" />
            {/* dotted texture */}
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

            {/* header */}
            <div className="relative mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <span className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        Top-rated near you
                    </span>
                    <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground md:text-4xl">
                        Featured{" "}
                        <span className="bg-gradient-to-r from-brand to-teal bg-clip-text text-transparent dark:from-brand-light">
                            Turfs
                        </span>
                    </h2>
                    <p className="mt-2 max-w-md text-base text-muted-foreground">
                        Hand-picked grounds players love. Book your next match in a tap.
                    </p>
                </div>

                <SeeAllTurfs className="hidden sm:inline-flex" />
            </div>

            {/* grid */}
            <div className="relative">
                <VenueListWrapper max={6} />
            </div>

            {/* mobile see-all */}
            <div className="relative mt-10 flex justify-center sm:hidden">
                <SeeAllTurfs />
            </div>
        </section>
    );
};

export default FeaturedTurfs;
