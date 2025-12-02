import { MapPin } from "lucide-react";

export default function EmptyState({ Icon = MapPin, title = "No Items Yet", description = "", children }) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="max-w-md mx-auto">
                <div className="bg-slate-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Icon className="w-12 h-12 text-slate-400" />
                </div>
                
                <h3 className="text-2xl font-bold text-slate-800 mb-3">{title}</h3>

                <p className="text-slate-600 mb-8">
                    {description}
                </p>

                {children}

            </div>
        </div>
    )
}