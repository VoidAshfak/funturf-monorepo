import { Sparkles } from "lucide-react";
import SectionShell from "@/components/SectionShell";
import VenueListWrapper from "@/components/VenueListWrapper";

export default function FeaturedTurfs() {
    return (
        <SectionShell
            tone="turf"
            icon={Sparkles}
            eyebrow="Top-rated near you"
            title="Featured"
            accent="Turfs"
            description="Hand-picked grounds players love. Book your next match in a tap."
            actionHref="/venues"
            actionLabel="See all turfs"
        >
            <VenueListWrapper max={6} />
        </SectionShell>
    );
}
