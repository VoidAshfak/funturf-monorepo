export default function Sports({ venue }) {
    return (
        <div className="glass-card rounded-2xl p-6">
            <h3 className="text-xl font-bold text-foreground mb-4">Sports Available</h3>
            <div className="flex flex-wrap gap-2">
                {venue.sports_available.map((sport) => (
                    <span key={sport} className="px-4 py-2 bg-gradient-to-r from-brand-dark to-brand text-white rounded-lg font-medium">
                        {sport}
                    </span>
                ))}
            </div>
        </div>
    )
}