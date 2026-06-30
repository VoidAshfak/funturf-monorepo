import { CheckCircle } from "lucide-react";

export default function Facilities({ venue }) {
    return (
        <div className="glass-card rounded-2xl p-6">
            <h3 className="text-xl font-bold text-foreground mb-4">Facilities</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {venue.facilities.map((facility) => (
                    <div key={facility} className="flex items-center gap-2 text-foreground">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span>{facility}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}