import { CircleDot, Dribbble, Feather, Target, Trophy, Volleyball } from "lucide-react";
import SoccerBall from "./SoccerBall";

// Sport -> vector icon. Everything is a lucide/inline SVG so no sport can render
// blank (the old PNG approach only shipped football.png + badminton.png, so
// Cricket/Tennis/Basketball/Volleyball showed a broken image). Keyed by the
// lowercased sport name; unknown sports fall back to a trophy.
const ICONS = {
    football: SoccerBall,
    cricket: CircleDot,
    badminton: Feather,
    tennis: Target,
    basketball: Dribbble,
    volleyball: Volleyball,
};

/**
 * Renders the icon for a sport name.
 * @param {string} sport - e.g. "Cricket" (case-insensitive)
 * plus any lucide icon props (className, size, ...).
 */
export default function SportIcon({ sport, className = "h-4 w-4", ...props }) {
    const Icon = ICONS[String(sport).toLowerCase()] ?? Trophy;
    return <Icon className={className} {...props} />;
}
