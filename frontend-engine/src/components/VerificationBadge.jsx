import { cn } from "@/lib/utils";
import { CircleDot, ShieldCheck, ShieldQuestion, Wrench } from "lucide-react";

// A turf's verification is set by platform admins. Until it's verified the turf
// can't take bookings (backend gate TURF_NOT_VERIFIED), so this badge tells the
// owner exactly where they stand. Reads the live `verified` flag, so it flips to
// "Verified" the moment that changes (on the next data load).
export function TurfVerifiedBadge({ verified, className }) {
    return verified ? (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary",
                className
            )}
        >
            <ShieldCheck className="h-3.5 w-3.5" /> Verified
        </span>
    ) : (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-500",
                className
            )}
        >
            <ShieldQuestion className="h-3.5 w-3.5" /> Pending review
        </span>
    );
}

const GROUND_STATUS = {
    available: { label: "Open for booking", cls: "bg-primary/15 text-primary", icon: CircleDot },
    maintenance: { label: "Under maintenance", cls: "bg-amber-500/15 text-amber-500", icon: Wrench },
    unavailable: { label: "Unavailable", cls: "bg-destructive/15 text-destructive", icon: CircleDot },
};

// A ground's own booking state (set by the owner when editing the ground).
export function GroundStatusBadge({ status, className }) {
    const s = GROUND_STATUS[status] ?? GROUND_STATUS.unavailable;
    const Icon = s.icon;
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold",
                s.cls,
                className
            )}
        >
            <Icon className="h-3.5 w-3.5" /> {s.label}
        </span>
    );
}
