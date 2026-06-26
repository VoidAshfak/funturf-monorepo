import { getAllVenues } from "@/utils/getData";
import { VenueCard } from "./VenueCard";
import Link from "next/link";
import EmptyState from "./EmptyState";
import VenueGrid from "./VenueGrid";

export default async function VenueList({ max, type }) {
    const { data: venues } = await getAllVenues();

    if (!venues || venues.length === 0) {
        return (
            <EmptyState 
            title="No Venue Yet"
            />
        );
    }

    let filteredVenues = venues;

    if (type === "upcoming") {
        filteredVenues = venues.filter(v => v.isUpcoming);
    }

    if (type === "popular") {
        filteredVenues = venues.filter(v => v.isPopular);
    }

    const finalVenues = max ? filteredVenues.slice(0, max) : filteredVenues;

    return (
        <VenueGrid>
            {finalVenues.map((venue) => (
                <Link href={`/venues/${venue.id}`} key={venue.id} className="venue-card">
                    <VenueCard venue={venue} />
                </Link>
            ))}
        </VenueGrid>
    );
}
