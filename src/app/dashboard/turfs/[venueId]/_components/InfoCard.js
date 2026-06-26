import { Calendar, Clock, Shield, Users } from "lucide-react";

const infoObject = [
    {
        id: 1,
        title: 'Established',
        value: 'establishment_year',
        icon: Calendar,
        iconColor: 'text-blue-600'
    },
    {
        id: 2,
        title: 'Ground',
        value: 'total_grounds',
        icon: Users,
        iconColor: 'text-green-600'
    },
    {
        id: 3,
        title: 'Days Advance',
        value: 'advance_booking_days',
        icon: Clock,
        iconColor: 'text-purple-600'
    },
    {
        id: 4,
        title: 'Total Bookings',
        value: 'total_bookings',
        icon: Shield,
        iconColor: 'text-muted-foreground'
    },
];

export default function InfoCard({ venue }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {infoObject.map(info => (
                <div key={info.id} className="glass-card p-4 rounded-2xl">
                    <info.icon className={`w-8 h-8 mb-2 ${info.iconColor}`} />
                    <div className="text-2xl font-bold text-foreground">{venue[info.value]}</div>
                    <div className="text-sm text-muted-foreground">{info.title}</div>
                </div>
            ))}
        </div>
    )
}