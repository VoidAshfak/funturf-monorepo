import SingleGround from "./SingleGround";

export default function GroundDetails({ venue }) {
    return (
        <div className="glass-card rounded-2xl p-6">
            <h3 className="text-xl font-bold text-foreground mb-4">
                Grounds ({venue.grounds.length})
            </h3>
            <div className="space-y-4">
                {venue.grounds.map((ground) => (
                    <SingleGround key={ground.id} ground={ground} venueId={venue.id} />
                ))}
            </div>
        </div>
    )
}