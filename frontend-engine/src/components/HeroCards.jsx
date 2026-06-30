import Link from "next/link";
import { MapPin, Star } from "lucide-react";

// Turf spotlight card for the hero carousel. Image-led, dark scrim so white text
// is safe in both themes; green accents match the hero's brand language.
export default function HeroCards({ item }) {
    return (
        <Link
            href="/venues"
            className="group relative block aspect-[4/5] w-full overflow-hidden rounded-3xl border border-border shadow-[0_22px_60px_-22px_rgba(0,0,0,0.5)]"
        >
            <img
                src={item.image}
                alt={item.name}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />

            {/* dark scrim — keeps overlay text readable on any image / theme */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />

            {/* sport chip */}
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-lg">
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
                {item.sport}
            </span>

            {/* rating */}
            <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md">
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                {item.rating}
            </span>

            {/* bottom content */}
            <div className="absolute inset-x-0 bottom-0 p-5">
                <h3 className="text-xl font-bold leading-tight text-white">{item.name}</h3>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm text-white/70">
                    <MapPin className="h-4 w-4 shrink-0" />
                    {item.location}
                </p>

                <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-white/70">
                        <span className="text-lg font-extrabold text-white">{item.price}</span>
                        /hr
                    </span>
                    <span className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-md transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
                        Book now
                    </span>
                </div>
            </div>
        </Link>
    );
}
