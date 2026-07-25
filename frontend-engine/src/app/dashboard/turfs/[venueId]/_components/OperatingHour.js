import { Clock } from "lucide-react";

export default function OperatingHour({ venue }) {
    const { opening_time, closing_time } = venue?.operating_hours ?? {};
    // No hours set = the turf trades round the clock, and every slot stays
    // bookable. Guarded because clearing the hours is a supported edit.
    const hasHours = Boolean(opening_time && closing_time);
    // Closing before opening is a legitimate overnight schedule (e.g. 18:00 → 02:00),
    // not a mistake — label it so the admin isn't left guessing.
    const overnight = hasHours && closing_time <= opening_time;

    return (
        <div className="glass-card rounded-2xl p-6">
            <h3 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                <Clock className="w-6 h-6 text-primary" />
                Operating Hours
            </h3>
            <div className="flex items-center justify-between text-lg">
                <span className="text-muted-foreground">{overnight ? "Overnight" : "Daily"}</span>
                <span className="font-semibold text-foreground">
                    {hasHours ? `${opening_time} - ${closing_time}` : "Open 24 hours"}
                </span>
            </div>
        </div>
    )
}