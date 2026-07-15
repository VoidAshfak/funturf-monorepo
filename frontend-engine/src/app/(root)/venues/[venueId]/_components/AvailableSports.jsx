import { flattenSports } from "@/utils/utility-functions";
import SportIcon from "@/components/icons/SportIcon";

const prettify = (s = "") =>
    String(s).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function AvailableSports({ sports_available = [] }) {
    // sport_type is a MultiSelect, so entries can be nested arrays — flatten first.
    const sports = flattenSports(sports_available);

    if (sports.length === 0) {
        return <p className="text-sm text-muted-foreground">No sports listed.</p>;
    }

    return (
        <div className="flex flex-wrap gap-3">
            {sports.map((sport) => (
                <button
                    key={sport}
                    type="button"
                    className="group glass-neutral flex h-28 w-28 flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_0_24px_rgba(29,185,84,0.25)]"
                >
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                        <SportIcon sport={sport} className="h-6 w-6" />
                    </span>
                    <p className="text-sm font-bold capitalize text-foreground">
                        {prettify(sport)}
                    </p>
                </button>
            ))}
        </div>
    );
}
