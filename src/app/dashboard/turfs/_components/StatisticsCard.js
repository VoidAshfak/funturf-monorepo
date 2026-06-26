import { Calendar, MapPin, Star, Users } from 'lucide-react';

export default function StatisticsCard({ venueByAdminId }) {

    const totalVenues = venueByAdminId.length;
    const totalGrounds = venueByAdminId.reduce((sum, v) => sum + v.total_grounds, 0);
    const avgRating = totalVenues > 0 ? (venueByAdminId.reduce((sum, v) => sum + parseFloat(v.rating || 0), 0) / totalVenues).toFixed(1) : '0.0';
    const totalBookings = venueByAdminId.reduce((sum, v) => sum + v.total_bookings, 0);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-muted-foreground text-sm font-medium">Total Venues</p>
                        <p className="text-3xl font-bold text-foreground mt-1">{totalVenues}</p>
                    </div>
                    <div className="bg-blue-100 p-3 rounded-lg">
                        <MapPin className="w-6 h-6 text-blue-600" />
                    </div>
                </div>
            </div>

            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-muted-foreground text-sm font-medium">Total Grounds</p>
                        <p className="text-3xl font-bold text-foreground mt-1">{totalGrounds}</p>
                    </div>
                    <div className="bg-green-100 p-3 rounded-lg">
                        <Users className="w-6 h-6 text-green-600" />
                    </div>
                </div>
            </div>

            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-muted-foreground text-sm font-medium">Average Rating</p>
                        <p className="text-3xl font-bold text-foreground mt-1">{avgRating}</p>
                    </div>
                    <div className="bg-yellow-100 p-3 rounded-lg">
                        <Star className="w-6 h-6 text-yellow-600" />
                    </div>
                </div>
            </div>

            <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-muted-foreground text-sm font-medium">Total Bookings</p>
                        <p className="text-3xl font-bold text-foreground mt-1">{totalBookings}</p>
                    </div>
                    <div className="bg-purple-100 p-3 rounded-lg">
                        <Calendar className="w-6 h-6 text-purple-600" />
                    </div>
                </div>
            </div>
        </div>
    )
}