import { Button } from "@/components/ui/button";
import { GroundStatusBadge } from "@/components/VerificationBadge";
import ImageWithFallback from "@/components/ImageWithFallback";
import { flattenSports } from "@/utils/utility-functions";
import { Edit } from "lucide-react";
import Link from "next/link";

export default function SingleGround({ ground, venueId }) {
    return (
        <div key={ground.id} className="glass-card rounded-lg overflow-hidden hover:border-primary/50 transition">
            {/* Banner — fixed height so object-cover crops; falls back to a
                placeholder when the ground has no photo yet. */}
            <div className="relative h-44 w-full">
                <ImageWithFallback
                    src={ground.images?.[0]}
                    alt={ground.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <Button asChild size="sm" className="absolute right-3 top-3 rounded-lg green-glow">
                    <Link href={`/dashboard/turfs/${venueId}/grounds/${ground.id}/edit`}>
                        <Edit className="h-4 w-4" />
                        Edit
                    </Link>
                </Button>
            </div>
            <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold text-foreground">{ground.name}</h4>
                    <GroundStatusBadge status={ground.status} />
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-muted-foreground">Type:</span>
                        <span className="ml-2 font-medium text-foreground">{ground.ground_type}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Sport:</span>
                        <span className="ml-2 font-medium capitalize text-foreground">
                            {flattenSports(ground.sport_type).join(", ")}
                        </span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Surface:</span>
                        <span className="ml-2 font-medium text-foreground">{ground.surface_type}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Capacity:</span>
                        <span className="ml-2 font-medium text-foreground">{ground.capacity_players} players</span>
                    </div>
                    <div className="col-span-2">
                        <span className="text-muted-foreground">Dimensions:</span>
                        <span className="ml-2 font-medium text-foreground">{ground.dimensions_length_m}m/{ground.dimensions_width_m}m</span>
                    </div>
                </div>
                <div className="pt-3 border-t border-border">
                    <div className="grid md:grid-cols-2 lg:grid-cols-4">
                        <div className="flex items-baseline gap-2 mb-2">
                            {/* <span className="text-muted-foreground">Regular</span> */}
                            <span className="text-2xl font-bold text-primary">{ground.hourly_rate}</span>
                            <span className="text-muted-foreground">/hour</span>
                            <span className="text-sm"> (Regular)</span>
                        </div>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-2xl font-bold text-primary">{ground.weekend_hourly_rate}</span>
                            <span className="text-muted-foreground">/hour </span>
                            <span className="text-sm"> (Weekend)</span>
                        </div>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-2xl font-bold text-primary">{ground.peak_hour_rate}</span>
                            <span className="text-muted-foreground">/hour </span>
                            <span className="text-sm"> (Peak hour)</span>
                        </div>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-2xl font-bold text-primary">{ground.off_peak_hour_rate}</span>
                            <span className="text-muted-foreground">/hour </span>
                            <span className="text-sm"> (Off peak)</span>
                        </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                        Minimum: {ground.minimum_booking_hours} hour{ground.minimum_booking_hours > 1 ? 's' : ''} • Maximum: {ground.maximum_booking_hours} hours
                    </div>
                </div>
                <div>
                    <div className="text-sm font-semibold text-foreground mb-2">Amenities:</div>
                    <div className="flex flex-wrap gap-2">
                        {ground.amenities.map((amenity) => (
                            <span key={amenity} className="px-3 py-1 bg-accent text-foreground rounded-full text-sm">
                                {amenity}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}