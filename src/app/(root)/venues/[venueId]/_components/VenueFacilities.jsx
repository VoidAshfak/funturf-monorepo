import { Check } from "lucide-react";

const prettify = (s = "") =>
    String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function VenueFacilities({ facilities = [] }) {
    if (facilities.length === 0) {
        return <p className="text-sm text-muted-foreground">No facilities listed.</p>;
    }

    return (
        <div className="flex flex-wrap gap-2.5">
            {facilities.map((facility, index) => (
                <span
                    key={index}
                    className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-foreground"
                >
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/15 text-primary">
                        <Check className="h-3 w-3" />
                    </span>
                    {prettify(facility)}
                </span>
            ))}
        </div>
    );
}
