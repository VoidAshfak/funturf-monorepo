export default function Sports({ venue }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Sports Available</h3>
            <div className="flex flex-wrap gap-2">
                {venue.sports_available.map((sport) => (
                    <span key={sport} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium">
                        {sport}
                    </span>
                ))}
            </div>
        </div>
    )
}