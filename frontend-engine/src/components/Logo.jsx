import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Native dimensions of `funturf-logo.svg`. The asset is a landscape lettermark,
 * NOT a square — rendering it at width === height distorts it, which is what
 * every call site used to do (40x40 on a 1.47:1 mark).
 */
const LOGO_W = 496;
const LOGO_H = 338;

/**
 * The FunTurf logo.
 *
 * Single source of truth for the mark so every surface — navbar, footer,
 * dashboard sidebar, auth panel — renders the same asset at the same ratio.
 * Give it a `height`; the width is derived, so the mark can never squash.
 *
 * The SVG ships pre-filled with the brand green (`--brand`, #1db954), which
 * clears contrast on both the light (#f5f5f5) and dark (#0a0a0a) backgrounds.
 * That means call sites need no `dark:invert` / `brightness-0` correction —
 * if you find yourself adding one, fix the asset instead.
 *
 * @param {number}  [height=30]     Rendered height in px.
 * @param {string}  [className]     Extra classes merged onto the <Image>.
 * @param {boolean} [priority=false] Set on above-the-fold usages (e.g. navbar)
 *   so Next preloads it instead of lazy-loading.
 */
export default function Logo({ height = 30, className, priority = false }) {
    return (
        <Image
            src="/assets/icons/funturf-logo.svg"
            alt="FunTurf"
            width={Math.round((height * LOGO_W) / LOGO_H)}
            height={height}
            priority={priority}
            className={cn("select-none", className)}
        />
    );
}
