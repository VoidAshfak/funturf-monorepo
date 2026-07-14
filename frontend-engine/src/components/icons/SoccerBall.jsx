/**
 * Soccer ball icon.
 *
 * lucide-react ships no football/soccer ball, so this is a hand-rolled icon that
 * follows lucide's contract exactly (24x24 viewBox, `currentColor` stroke, 2px
 * stroke, round caps/joins, no fill). That means it can be dropped in anywhere a
 * lucide icon goes — size and colour come from Tailwind classes, e.g.
 * `<SoccerBall className="h-6 w-6 text-foreground" />`.
 *
 * Geometry: the outer ball, the centre pentagon panel, and the five seams that
 * run from the pentagon's corners out to the edge.
 */
export default function SoccerBall({ className, ...props }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
            {...props}
        >
            {/* ball */}
            <circle cx="12" cy="12" r="10" />
            {/* centre pentagon panel */}
            <path d="M12 8 15.8 10.76 14.35 15.24 9.65 15.24 8.2 10.76Z" />
            {/* seams: pentagon corner -> ball edge */}
            <path d="M12 8V2" />
            <path d="m15.8 10.76 5.71-1.85" />
            <path d="m14.35 15.24 3.53 4.85" />
            <path d="m9.65 15.24-3.53 4.85" />
            <path d="M8.2 10.76 2.49 8.91" />
        </svg>
    );
}
