import { getAllVenues } from "@/utils/getData";
import { VenueCard } from "./VenueCard";
import Link from "next/link";
import EmptyState from "./EmptyState";
import CardGrid from "./CardGrid";

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
        <CardGrid>
            {finalVenues.map((venue) => (
                <Link href={`/venues/${venue.id}`} key={venue.id} className="grid-card">
                    <VenueCard venue={venue} />
                </Link>
            ))}
        </CardGrid>
    );
}
