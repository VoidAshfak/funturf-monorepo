import { Clock, Star, MapPin, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { getLocationString } from "@/utils/utility-functions";

export function VenueCard({ className, venue }) {
    const { name, address_line_1, images, operating_hours, rating } = venue;

    return (
        <Card
            className={`group gap-0 overflow-hidden rounded-3xl p-0 transition-all duration-300 will-change-transform hover:-translate-y-2 hover:z-10 hover:shadow-[0_24px_60px_-20px_rgba(0,0,0,0.4)] cursor-pointer ${className}`}
        >
            {/* Media */}
            <div className="relative h-52 w-full overflow-hidden">
                <Image
                    src={images?.[0] || "/assets/images/banner1.jpg"}
                    alt={name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                />
                {/* scrim for depth + chip legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                {/* rating */}
                <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    {rating ?? "New"}
                </span>

                {/* hours */}
                {operating_hours?.opening_time && (
                    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
                        <Clock className="h-3.5 w-3.5" />
                        {operating_hours.opening_time} – {operating_hours.closing_time}
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                    <h3 className="truncate bg-gradient-to-r from-brand to-teal bg-clip-text text-lg font-bold text-transparent dark:from-brand-light">
                        {name}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="line-clamp-1">
                            {getLocationString(address_line_1)}
                        </span>
                    </p>
                </div>

                {/* book hint */}
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-foreground transition-all duration-300 group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground group-hover:rotate-45">
                    <ArrowUpRight className="h-5 w-5" />
                </span>
            </div>
        </Card>
    );
}
