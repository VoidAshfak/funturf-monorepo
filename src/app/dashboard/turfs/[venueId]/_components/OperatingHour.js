import { Clock } from "lucide-react";

export default function OperatingHour({ venue }) {
    return (
        <div className="glass-card rounded-2xl p-6">
            <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-6 h-6 text-primary" />
                Operating Hours
            </h3>
            <div className="flex items-center justify-between text-lg">
                <span className="text-muted-foreground">Daily</span>
                <span className="font-semibold text-foreground">{venue.operating_hours.opening_time} - {venue.operating_hours.closing_time}</span>
            </div>
        </div>
    )
}