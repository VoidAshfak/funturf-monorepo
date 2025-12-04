import { Button } from "@/components/ui/button";
import { getIndividualVenueByVenueId } from "@/utils/getData";
import { Edit, Settings } from 'lucide-react';
import ContactInfo from "./_components/ContactInfo";
import Facilities from "./_components/Facilities";
import GroundDetails from "./_components/GroundDetails";
import InfoCard from "./_components/InfoCard";
import OperatingHour from "./_components/OperatingHour";
import Policies from "./_components/Policies";
import Sports from "./_components/Sports";

export default async function AdminVenueDetailsPage({ params }) {

    const { venueId } = await (params);

    const { data: venue } = await getIndividualVenueByVenueId(venueId);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col gap-6">
            {/* Admin Header */}
            <div
                className="bg-white border-b border-slate-200 sticky top-12 z-50 shadow-2xl"
            >
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Settings className="w-6 h-6 text-slate-600" />
                        <h1 className="text-xl font-bold text-slate-900">Admin Panel - Venue Management</h1>
                    </div>
                    <Button
                        // onClick={handleEditVenue}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-sm"
                    >
                        <Edit className="w-4 h-4" />
                        Edit Venue
                    </Button>
                </div>
            </div>

            {/* Quick Info Cards */}
            <InfoCard venue={venue} />

            {/* Operating Hours */}
            <OperatingHour venue={venue} />

            {/* Sports Available */}
            <Sports venue={venue} />

            {/* Facilities */}
            <Facilities venue={venue} />

            {/* Ground Details */}
            <GroundDetails venue={venue} />

            {/* Policies */}
            <Policies venue={venue} />

            {/* Contact Information */}
            <ContactInfo venue={venue} />
        </div>
    )
}