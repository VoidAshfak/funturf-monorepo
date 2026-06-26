import { Button } from "@/components/ui/button";
import { uploadImageObjArray, uploadSingleImageObj } from "@/utils/image-upload";
import { getLocationString, getStatusColor } from "@/utils/utility-functions";
import {
    Building2,
    Clock,
    DollarSign,
    Globe,
    Mail,
    MapPin,
    Phone,
    Users
} from "lucide-react";
import { useRouter } from "next/navigation";

export default function StepFive({ formdata, setStep }) {
    const router = useRouter();

    const createVenue = async () => {

        try {
            const mainImgUrl = await uploadSingleImageObj(formdata.images);

            const updatedGrounds = await Promise.all(
                formdata.grounds.map(async (ground) => {
                    const uploadedGroundImages = await uploadImageObjArray(ground.images);

                    return {
                        ...ground,
                        images: uploadedGroundImages, // only URLs
                    };
                })
            );

            const finalPayload = {
                ...formdata,
                images: mainImgUrl ? [mainImgUrl] : [],
                grounds: updatedGrounds,
            };

            const response = await fetch("https://app4-osju.onrender.com/api/v1/venues/create-venue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(finalPayload),
            });

            const data = await response.json();

            if (data.success) {
                router.push('/dashboard/turfs');
            };

        } catch (error) {
            console.error("Error submitting:", error);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-foreground">Review Your Venue</h2>
                <p className="text-muted-foreground mt-2">Please review all information before submitting</p>
            </div>

            {/* Basic Information */}
            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Venue Name</p>
                        <p className="font-medium text-foreground">{formdata.name || '-'}</p>
                    </div>

                    {formdata.establishment_year && (
                        <div>
                            <p className="text-sm text-muted-foreground">Establishment Year</p>
                            <p className="font-medium text-foreground">{formdata.establishment_year}</p>
                        </div>
                    )}

                    <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground">Description</p>
                        <p className="font-medium text-foreground">{formdata.description || '-'}</p>
                    </div>
                </div>
            </div>

            {/* Contact Information */}
            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                    <Phone className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-foreground">Contact Information</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-sm text-muted-foreground">Address</p>
                            <p className="font-medium text-foreground">
                                {getLocationString(formdata.address_line_1)}
                            </p>
                            {formdata.address_line_2 && (
                                <p className="text-sm text-muted-foreground mt-1">{formdata.address_line_2}</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3">
                        {formdata.phone && (
                            <div className="flex items-center gap-3">
                                <Phone className="h-5 w-5 text-gray-400" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Phone</p>
                                    <p className="font-medium text-foreground">{formdata.phone}</p>
                                </div>
                            </div>
                        )}

                        {formdata.email && (
                            <div className="flex items-center gap-3">
                                <Mail className="h-5 w-5 text-gray-400" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Email</p>
                                    <p className="font-medium text-foreground">{formdata.email}</p>
                                </div>
                            </div>
                        )}

                        {formdata.website_url && (
                            <div className="flex items-center gap-3">
                                <Globe className="h-5 w-5 text-gray-400" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Website</p>
                                    <p className="font-medium text-foreground">{formdata.website_url}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Operating Hours & Policies */}
            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                    <Clock className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-foreground">Operating Hours & Policies</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Operating Hours</p>
                        <p className="font-medium text-foreground">
                            {formdata.operating_hours?.opening_time} - {formdata.operating_hours?.closing_time}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-muted-foreground">Advance Booking</p>
                        <p className="font-medium text-foreground">{formdata.advance_booking_days} days</p>
                    </div>

                    <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground">Rules & Regulations</p>
                        <p className="font-medium text-foreground">{formdata.rules_and_regulations || '-'}</p>
                    </div>

                    <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground">Cancellation Policy</p>
                        <p className="font-medium text-foreground">{formdata.cancellation_policy || '-'}</p>
                    </div>
                </div>
            </div>

            {/* Sports & Facilities */}
            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                    <Users className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-foreground">Sports & Facilities</h3>
                </div>

                <div className="space-y-4">
                    <div>
                        <p className="text-sm text-muted-foreground mb-2">Available Sports</p>
                        <div className="flex flex-wrap gap-2">
                            {formdata.sports_available?.map((sport, idx) => (
                                <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                    {sport}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-sm text-muted-foreground mb-2">Facilities</p>
                        <div className="flex flex-wrap gap-2">
                            {formdata.facilities?.map((facility, idx) => (
                                <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                    {facility}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Grounds Summary */}
            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-foreground">Grounds Summary</h3>
                </div>

                <div className="space-y-4">
                    {formdata.grounds?.map((ground, idx) => (
                        <div key={idx} className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
                            {/* Ground Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                    <h4 className="font-semibold text-foreground text-lg">{ground.name}</h4>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        <span className="text-sm text-muted-foreground">{ground.sport_type}</span>
                                        <span className="text-gray-400">•</span>
                                        <span className="text-sm text-muted-foreground">{ground.ground_type}</span>
                                        <span className="text-gray-400">•</span>
                                        <span className="text-sm text-muted-foreground">{ground.surface_type}</span>
                                    </div>
                                </div>
                                <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(ground.status)}`}>
                                    <span>{ground.status}</span>
                                </div>
                            </div>

                            {/* Ground Details Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                                {ground.capacity_players && (
                                    <div className="bg-accent p-2 rounded">
                                        <p className="text-xs text-muted-foreground">Capacity</p>
                                        <p className="font-medium text-sm">{ground.capacity_players} players</p>
                                    </div>
                                )}

                                {ground.hourly_rate && (
                                    <div className="bg-accent p-2 rounded">
                                        <p className="text-xs text-muted-foreground">Hourly Rate</p>
                                        <p className="font-medium text-sm">৳{ground.hourly_rate}</p>
                                    </div>
                                )}

                                {ground.weekend_hourly_rate && (
                                    <div className="bg-accent p-2 rounded">
                                        <p className="text-xs text-muted-foreground">Weekend Rate</p>
                                        <p className="font-medium text-sm">৳{ground.weekend_hourly_rate}</p>
                                    </div>
                                )}

                                {ground.peak_hour_rate && (
                                    <div className="bg-accent p-2 rounded">
                                        <p className="text-xs text-muted-foreground">Peak Rate</p>
                                        <p className="font-medium text-sm">৳{ground.peak_hour_rate}</p>
                                    </div>
                                )}

                                {ground.off_peak_hour_rate && (
                                    <div className="bg-accent p-2 rounded">
                                        <p className="text-xs text-muted-foreground">Off-Peak Rate</p>
                                        <p className="font-medium text-sm">৳{ground.off_peak_hour_rate}</p>
                                    </div>
                                )}

                                {ground.minimum_booking_hours && (
                                    <div className="bg-accent p-2 rounded">
                                        <p className="text-xs text-muted-foreground">Min Booking</p>
                                        <p className="font-medium text-sm">{ground.minimum_booking_hours}h</p>
                                    </div>
                                )}

                                {ground.maximum_booking_hours && (
                                    <div className="bg-accent p-2 rounded">
                                        <p className="text-xs text-muted-foreground">Max Booking</p>
                                        <p className="font-medium text-sm">{ground.maximum_booking_hours}h</p>
                                    </div>
                                )}
                            </div>

                            {/* Amenities */}
                            {ground.amenities && ground.amenities.length > 0 && (
                                <div className="mt-3">
                                    <p className="text-xs text-muted-foreground mb-1">Amenities</p>
                                    <div className="flex flex-wrap gap-1">
                                        {ground.amenities.map((amenity, aIdx) => (
                                            <span key={aIdx} className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">
                                                {amenity}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Notes */}
                            {ground.notes && (
                                <div className="mt-3 pt-3 border-t border-border">
                                    <p className="text-xs text-muted-foreground">Notes</p>
                                    <p className="text-sm text-foreground">{ground.notes}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-between">
                <Button
                    type="button"
                    onClick={() => setStep(prev => prev - 1)}
                >Previous</Button>

                <Button
                    onClick={createVenue}
                >Submit</Button>
            </div>
        </div>
    );
}