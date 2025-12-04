import { Clock } from "lucide-react";

export default function OperatingHour({ venue }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Clock className="w-6 h-6 text-blue-600" />
                Operating Hours
            </h3>
            <div className="flex items-center justify-between text-lg">
                <span className="text-slate-600">Daily</span>
                <span className="font-semibold text-slate-900">{venue.operating_hours.opening_time} - {venue.operating_hours.closing_time}</span>
            </div>
        </div>
    )
}