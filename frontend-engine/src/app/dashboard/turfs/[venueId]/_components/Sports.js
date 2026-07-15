import { flattenSports } from "@/utils/utility-functions";

export default function Sports({ venue }) {
    // sport_type is a MultiSelect, so sports_available can be nested arrays.
    const sports = flattenSports(venue.sports_available);

    return (
        <div className="glass-card rounded-2xl p-6">
            <h3 className="text-xl font-bold text-foreground mb-4">Sports Available</h3>
            <div className="flex flex-wrap gap-2">
                {sports.map((sport) => (
                    <span key={sport} className="px-4 py-2 bg-gradient-to-r from-brand-dark to-brand text-white rounded-lg font-medium">
                        {sport}
                    </span>
                ))}
            </div>
        </div>
    )
}
