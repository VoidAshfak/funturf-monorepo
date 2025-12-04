import { CheckCircle, XCircle } from "lucide-react";

export default function Policies({ venue }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Policies</h3>
            <div className="space-y-4">
                <div className="flex gap-3">
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
                    <div>
                        <h4 className="font-semibold text-slate-900">Rules & Regulations</h4>
                        <p className="text-slate-600">{venue.rules_and_regulations}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
                    <div>
                        <h4 className="font-semibold text-slate-900">Cancellation Policy</h4>
                        <p className="text-slate-600">{venue.cancellation_policy}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}