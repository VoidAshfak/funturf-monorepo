"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { MapPin, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

const EventMap = dynamic(() => import("./EventMap"), {
    ssr: false,
    loading: () => <div className="shimmer h-full w-full" />,
});

export default function MapDialog({ lat, lng, address, label, compact = false }) {
    const [open, setOpen] = useState(false);

    return (
        <>
            {compact ? (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-brand-dark"
                >
                    Map <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
            ) : (
                <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="rounded-full px-6"
                    onClick={() => setOpen(true)}
                >
                    <MapPin className="h-4 w-4" />
                    View Map
                </Button>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="overflow-hidden p-0 sm:max-w-3xl">
                    <DialogHeader className="px-5 pt-5">
                        <DialogTitle className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-primary" />
                            {label || "Location"}
                        </DialogTitle>
                        {address && (
                            <DialogDescription className="text-left">
                                {address}
                            </DialogDescription>
                        )}
                    </DialogHeader>
                    <div className="p-5 pt-3">
                        <div className="h-[55vh] w-full overflow-hidden rounded-2xl border border-border">
                            {open && (
                                <EventMap
                                    lat={lat}
                                    lng={lng}
                                    address={address}
                                    label={label}
                                />
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
