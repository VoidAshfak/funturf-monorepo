import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import EmptyState from "@/components/EmptyState";
import { getAllVenuesByAdminId } from "@/utils/getData";
import { MapPin } from 'lucide-react';
import { getServerSession } from "next-auth";
import { Fragment } from "react";
import AddButton from "./_components/AddButton";
import AdminVenueCard from "./_components/AdminVenueCard";
import StatisticsCard from "./_components/StatisticsCard";

export default async function DashboardTurfsPage() {

    const session = await getServerSession(authOptions);
    const { user: { id } } = session;

    const { data: venueByAdminId } = await getAllVenuesByAdminId(id)
    const isEmpty = venueByAdminId.length === 0;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold text-slate-800 mb-2">Venue Dashboard</h1>
                        <p className="text-slate-600">Manage and monitor your sports venues</p>
                    </div>

                    {!isEmpty && (
                        <AddButton
                            buttonText="Add New Venue"
                        />
                    )}
                </div>

                {/* Statistics Cards */}
                <StatisticsCard
                    venueByAdminId={venueByAdminId}
                />

                {/* Venue Cards */}
                {isEmpty ? (
                    <EmptyState
                        Icon={MapPin}
                        title="No Venues Yet"
                        description="You haven't added any venues yet. Get started by adding your first sports venue to begin managing bookings and grounds."
                    >
                        <AddButton
                            buttonText=" Add Your First Venue"
                        />
                    </EmptyState>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {venueByAdminId.map((venue) => (
                            <Fragment key={venue.id}>
                                <AdminVenueCard venue={venue} />
                            </Fragment>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}