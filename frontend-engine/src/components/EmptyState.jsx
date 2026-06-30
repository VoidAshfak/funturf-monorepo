import { MapPin } from "lucide-react";

export default function EmptyState({ Icon = MapPin, title = "No Items Yet", description = "", children }) {
    return (
        <div className="glass-neutral rounded-2xl border border-border p-12 text-center">
            <div className="max-w-md mx-auto">
                <div className="bg-white/5 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Icon className="w-12 h-12 text-muted-foreground" />
                </div>

                <h3 className="text-2xl font-bold text-foreground mb-3">{title}</h3>

                <p className="text-muted-foreground mb-8">
                    {description}
                </p>

                {children}

            </div>
        </div>
    )
}