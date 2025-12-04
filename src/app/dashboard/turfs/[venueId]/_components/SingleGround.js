import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";
import Image from "next/image";

export default function SingleGround({ ground }) {
    return (
        <div key={ground.id} className="border border-slate-200 rounded-lg overflow-hidden hover:border-blue-300 transition">
            <div className="relative">
                <Image
                    src={ground.images[0]}
                    alt={ground.name}
                    width={800}
                    height={200}
                    className="w-full object-cover"
                />
                {/* <Button
                    className="absolute top-3 right-3 bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-600 p-2 rounded-lg shadow-md transition flex items-center gap-2 font-medium"
                >
                    <Edit className="w-4 h-4" />
                    Edit Ground
                </Button> */}
            </div>
            <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className="text-lg font-bold text-slate-900">{ground.name}</h4>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${ground.status === 'available'
                        ? 'bg-green-100 text-green-700'
                        : ground.status === 'maintenance'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                        {ground.status === 'available' ? 'Available' : ground.status === 'maintenance' ? 'Maintenance' : 'Unavailable'}
                    </span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-slate-600">Type:</span>
                        <span className="ml-2 font-medium text-slate-900">{ground.ground_type}</span>
                    </div>
                    <div>
                        <span className="text-slate-600">Sport:</span>
                        {/* <span className="ml-2 font-medium text-slate-900">{ground.sport_type.map(sport => sport).join(", ")}</span> */}
                    </div>
                    <div>
                        <span className="text-slate-600">Surface:</span>
                        <span className="ml-2 font-medium text-slate-900">{ground.surface_type}</span>
                    </div>
                    <div>
                        <span className="text-slate-600">Capacity:</span>
                        <span className="ml-2 font-medium text-slate-900">{ground.capacity_players} players</span>
                    </div>
                    <div className="col-span-2">
                        <span className="text-slate-600">Dimensions:</span>
                        <span className="ml-2 font-medium text-slate-900">{ground.dimensions_length_m}m/{ground.dimensions_width_m}m</span>
                    </div>
                </div>
                <div className="pt-3 border-t border-slate-200">
                    <div className="grid md:grid-cols-2 lg:grid-cols-4">
                        <div className="flex items-baseline gap-2 mb-2">
                            {/* <span className="text-slate-600">Regular</span> */}
                            <span className="text-2xl font-bold text-blue-600">{ground.hourly_rate}</span>
                            <span className="text-slate-600">/hour</span>
                            <span className="text-sm"> (Regular)</span>
                        </div>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-2xl font-bold text-blue-600">{ground.weekend_hourly_rate}</span>
                            <span className="text-slate-600">/hour </span>
                            <span className="text-sm"> (Weekend)</span>
                        </div>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-2xl font-bold text-blue-600">{ground.peak_hour_rate}</span>
                            <span className="text-slate-600">/hour </span>
                            <span className="text-sm"> (Peak hour)</span>
                        </div>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-2xl font-bold text-blue-600">{ground.off_peak_hour_rate}</span>
                            <span className="text-slate-600">/hour </span>
                            <span className="text-sm"> (Off peak)</span>
                        </div>
                    </div>
                    <div className="text-sm text-slate-600">
                        Minimum: {ground.minimum_booking_hours} hour{ground.minimum_booking_hours > 1 ? 's' : ''} • Maximum: {ground.maximum_booking_hours} hours
                    </div>
                </div>
                <div>
                    <div className="text-sm font-semibold text-slate-900 mb-2">Amenities:</div>
                    <div className="flex flex-wrap gap-2">
                        {ground.amenities.map((amenity) => (
                            <span key={amenity} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                                {amenity}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}