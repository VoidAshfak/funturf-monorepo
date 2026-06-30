import { CheckCircle, XCircle } from "lucide-react";

export default function Policies({ venue }) {
    return (
        <div className="glass-card rounded-2xl p-6">
            <h3 className="text-xl font-bold text-foreground mb-4">Policies</h3>
            <div className="space-y-4">
                <div className="flex gap-3">
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-1" />
                    <div>
                        <h4 className="font-semibold text-foreground">Rules & Regulations</h4>
                        <p className="text-muted-foreground">{venue.rules_and_regulations}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-1" />
                    <div>
                        <h4 className="font-semibold text-foreground">Cancellation Policy</h4>
                        <p className="text-muted-foreground">{venue.cancellation_policy}</p>
                    </div>
                </div>
            </div>
        </div>
    )
}