import Image from "next/image";

/**
 * A turf's logo + name, as shown in the admin panel (sidebar header, top bar).
 *
 * Falls back to an initials tile when the turf has no logo, so the layout never
 * shifts between a branded and an unbranded turf — the mark occupies the same
 * box either way.
 *
 * Pure presentation, no data fetching: whoever renders it already has the turf.
 *
 * @param {string}  name      turf name
 * @param {string}  [logoUrl] `turfs.logo_url`
 * @param {number}  [size]    logo edge in px
 * @param {boolean} [showName]
 * @param {string}  [subtitle] small line under the name
 * @param {string}  [className]
 */
export default function TurfBrand({
    name,
    logoUrl,
    size = 36,
    showName = true,
    subtitle,
    className = "",
}) {
    const label = name || "Your turf";
    // Up to two initials from the first two words: "Gulshan Sports Arena" -> "GS".
    const initials =
        label
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0])
            .join("")
            .toUpperCase() || "T";

    return (
        <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
            {logoUrl ? (
                <Image
                    src={logoUrl}
                    alt={`${label} logo`}
                    width={size}
                    height={size}
                    // `object-contain` on a neutral tile: a logo is artwork, not a
                    // photo — cropping it to fill would cut the mark in half.
                    className="shrink-0 rounded-lg bg-muted object-contain"
                    style={{ width: size, height: size }}
                />
            ) : (
                <span
                    aria-hidden="true"
                    className="grid shrink-0 place-items-center rounded-lg bg-primary/15 font-extrabold text-primary"
                    style={{ width: size, height: size, fontSize: size * 0.38 }}
                >
                    {initials}
                </span>
            )}

            {showName && (
                <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-sm font-extrabold text-foreground">
                        {label}
                    </span>
                    {subtitle && (
                        <span className="truncate text-[11px] text-muted-foreground">
                            {subtitle}
                        </span>
                    )}
                </span>
            )}
        </div>
    );
}
