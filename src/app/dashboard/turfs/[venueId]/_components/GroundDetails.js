import SingleGround from "./SingleGround";

export default function GroundDetails({ venue }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">
                Grounds ({venue.grounds.length})
            </h3>
            <div className="space-y-4">
                {venue.grounds.map((ground) => (
                    <SingleGround key={ground.id} ground={ground} />
                ))}
            </div>
        </div>
    )
}