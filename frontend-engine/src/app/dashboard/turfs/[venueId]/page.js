import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { Button } from "@/components/ui/button";
import { TurfVerifiedBadge } from "@/components/VerificationBadge";
import EditTurfDialog from "@/components/EditTurfDialog";
import TurfBrand from "@/components/TurfBrand";
import { getIndividualVenueByVenueId } from "@/utils/getData";
import { Plus } from 'lucide-react';
import Link from "next/link";
import ContactInfo from "./_components/ContactInfo";
import Facilities from "./_components/Facilities";
import GroundDetails from "./_components/GroundDetails";
import InfoCard from "./_components/InfoCard";
import OperatingHour from "./_components/OperatingHour";
import Policies from "./_components/Policies";
import Sports from "./_components/Sports";

export default async function AdminVenueDetailsPage({ params }) {

    const { venueId } = await (params);

    const [session, { data: venue }] = await Promise.all([
        getServerSession(authOptions),
        getIndividualVenueByVenueId(venueId),
    ]);

    // Who may edit: the turf's own admin, or a platform moderator. This only
    // controls whether the affordance renders — PATCH /venues/:venue_id repeats
    // the check server-side, so hiding the button is never the security boundary.
    const isOwner =
        session?.user?.user_type === "super_admin" ||
        (Boolean(session?.user?.id) && session.user.id === venue?.admin_user_id);

    return (
        <div className="flex flex-col gap-6">
            {/* Page header (in-flow — the dashboard top bar is the only sticky one). */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    {/* The turf's own logo leads, falling back to an initials tile —
                        the generic gear icon told the owner nothing about whose
                        panel this is. */}
                    <TurfBrand
                        name={venue.name}
                        logoUrl={venue.logo_url}
                        size={44}
                        showName={false}
                    />
                    <div className="min-w-0">
                        {/* The turf's own name is the page title. */}
                        <div className="flex items-center gap-2">
                            <h1 className="truncate text-2xl font-bold text-foreground">{venue.name}</h1>
                            {/* Turf verification — reflects the live `verified` flag. */}
                            <TurfVerifiedBadge verified={venue.verified} />
                        </div>
                        <p className="text-xs text-muted-foreground">Manage Grounds</p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {/* Server-gated: only the turf's own admin sees the edit control.
                        PATCH /venues/:id enforces the same rule independently. */}
                    {isOwner && <EditTurfDialog venue={venue} />}
                    <Button asChild className="green-glow flex shrink-0 items-center gap-2 rounded-lg font-medium">
                        <Link href="/dashboard/turfs/add-ground">
                            <Plus className="w-4 h-4" />
                            Add Ground
                        </Link>
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