/**
 * Turf-branded theming for the admin panel.
 *
 * A turf owner uploads a logo; we sample its dominant colour once (at upload
 * time, in the browser, from the local file — never on every page load) and
 * store it as `turfs.theme_color`. The dashboard then re-points a handful of CSS
 * custom properties at that colour so the panel wears the turf's brand while the
 * public site stays FunTurf green.
 *
 * Two rules make this safe rather than merely pretty:
 *
 *  1. **Accents only.** Buttons, active nav, focus rings and links change.
 *     Page/card/sidebar surfaces do not. A saturated logo can't turn the whole
 *     panel into an unreadable slab.
 *  2. **Everything is clamped.** Raw dominant colours skew near-white or
 *     near-black, and the readable text colour flips depending on brightness. We
 *     force the accent into a usable lightness band and derive its foreground
 *     from luminance, so no logo can produce white-on-yellow buttons.
 */

// ---------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------

/** "#RRGGBB" -> {r,g,b} 0..255, or null if it isn't a hex triple. */
export function hexToRgb(hex) {
    const m = /^#([0-9a-f]{6})$/i.exec(String(hex ?? "").trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const toHex = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");

/** {r,g,b} -> "#rrggbb". */
export function rgbToHex({ r, g, b }) {
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** {r,g,b} 0..255 -> {h 0..360, s 0..1, l 0..1}. */
export function rgbToHsl({ r, g, b }) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;

    if (d === 0) return { h: 0, s: 0, l };

    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;

    return { h, s, l };
}

/** {h,s,l} -> {r,g,b} 0..255. */
export function hslToRgb({ h, s, l }) {
    if (s === 0) {
        const v = l * 255;
        return { r: v, g: v, b: v };
    }
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const hp = ((h % 360) + 360) % 360 / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    const [r1, g1, b1] =
        hp < 1 ? [c, x, 0] :
        hp < 2 ? [x, c, 0] :
        hp < 3 ? [0, c, x] :
        hp < 4 ? [0, x, c] :
        hp < 5 ? [x, 0, c] :
                 [c, 0, x];
    const m = l - c / 2;
    return { r: (r1 + m) * 255, g: (g1 + m) * 255, b: (b1 + m) * 255 };
}

/**
 * WCAG relative luminance (0 = black, 1 = white).
 * Used to pick a readable foreground rather than guessing from lightness —
 * pure yellow and pure blue have the same HSL lightness but wildly different
 * perceived brightness.
 */
export function relativeLuminance({ r, g, b }) {
    const lin = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Near-black or white text, whichever actually reads on `hex`. */
export function readableForeground(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return "#ffffff";
    // 0.45 rather than 0.5: the panel's near-black (#0a0a0a) is darker than pure
    // black text would be, so it stays legible a little further down the scale.
    return relativeLuminance(rgb) > 0.45 ? "#0a0a0a" : "#ffffff";
}

/**
 * Force a colour into a band that works as a UI accent on BOTH the dark and the
 * light theme. Sampled logo colours are routinely too pale (washed-out on light)
 * or too dark (invisible on dark), and fully desaturated ones make every button
 * look disabled.
 */
export function normalizeAccent(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    const { h, s, l } = rgbToHsl(rgb);
    return rgbToHex(
        hslToRgb({
            h,
            s: Math.min(0.9, Math.max(0.25, s)),
            l: Math.min(0.62, Math.max(0.35, l)),
        })
    );
}

/** Same hue, shifted lighter/darker — for gradients and hover states. */
function shiftLightness(hex, delta) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;
    const { h, s, l } = rgbToHsl(rgb);
    return rgbToHex(hslToRgb({ h, s, l: Math.min(0.95, Math.max(0.05, l + delta)) }));
}

// ---------------------------------------------------------------------------
// Dominant-colour sampling
// ---------------------------------------------------------------------------

/** Pixels that tell us nothing about a brand: transparent, or near white/black. */
const isUninformative = (r, g, b, a) => {
    if (a < 200) return true;                      // transparent logo padding
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max > 240 && min > 240) return true;       // white background
    if (max < 24) return true;                     // black outline / shadow
    return false;
};

/**
 * Sample the dominant brand colour of a logo image.
 *
 * Runs against a LOCAL object URL (the file the owner just picked), so the
 * canvas is never tainted and no CORS round-trip is involved — which is also why
 * this happens once at upload rather than on every dashboard render.
 *
 * Colours are bucketed coarsely (32 levels per channel) and weighted by
 * saturation, so a logo's small vivid mark beats its large flat background.
 *
 * @param   {string} src object URL / data URL of the image
 * @returns {Promise<string|null>} "#rrggbb", or null when there's no usable
 *          colour (a pure black-and-white logo) — caller should fall back to the
 *          default palette rather than inventing one.
 */
export async function extractDominantColor(src) {
    if (typeof window === "undefined" || !src) return null;

    const image = await new Promise((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Couldn't read that image"));
        img.src = src;
    });

    // A thumbnail is plenty — we want the dominant hue, not detail, and this
    // keeps the whole thing well under a frame.
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, size, size);

    let data;
    try {
        data = ctx.getImageData(0, 0, size, size).data;
    } catch {
        // Tainted canvas (a remote image without CORS headers). Not fatal —
        // the owner can still set the colour by hand.
        return null;
    }

    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
        const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
        if (isUninformative(r, g, b, a)) continue;

        const key = `${r >> 3},${g >> 3},${b >> 3}`;
        const { s } = rgbToHsl({ r, g, b });
        // Weight by saturation so a vivid accent outvotes a large muted field.
        const weight = 1 + s * 3;

        const prev = buckets.get(key);
        if (prev) {
            prev.weight += weight;
            prev.r += r; prev.g += g; prev.b += b; prev.n += 1;
        } else {
            buckets.set(key, { weight, r, g, b, n: 1 });
        }
    }

    if (buckets.size === 0) return null;

    let best = null;
    for (const bucket of buckets.values()) {
        if (!best || bucket.weight > best.weight) best = bucket;
    }

    // Average within the winning bucket so the result isn't a quantisation artefact.
    return normalizeAccent(rgbToHex({ r: best.r / best.n, g: best.g / best.n, b: best.b / best.n }));
}

// ---------------------------------------------------------------------------
// Applying it
// ---------------------------------------------------------------------------

/**
 * CSS custom properties that repaint the panel's ACCENTS in the turf's colour.
 *
 * Spread onto a wrapper's `style` — scoped to that subtree, so the public site
 * and anything outside the dashboard keep the FunTurf palette. Returns null for
 * a missing/invalid colour, and the caller should then pass no `style` at all so
 * the stylesheet defaults win untouched.
 *
 * @param   {string|null} themeColor `turfs.theme_color`
 * @returns {object|null} style object, or null to use the default palette
 */
export function turfThemeVars(themeColor) {
    const accent = normalizeAccent(themeColor);
    if (!accent) return null;

    const foreground = readableForeground(accent);
    const rgb = hexToRgb(accent);

    return {
        // shadcn/ui accent tokens
        "--primary": accent,
        "--primary-foreground": foreground,
        "--ring": accent,
        "--sidebar-primary": accent,
        "--sidebar-primary-foreground": foreground,
        "--sidebar-ring": accent,
        // Funturf brand scale — drives gradient headers and chips
        "--brand": accent,
        "--brand-light": shiftLightness(accent, 0.08),
        "--brand-dark": shiftLightness(accent, -0.1),
        "--brand-muted": shiftLightness(accent, -0.2),
        // `.green-glow` reads this instead of a hardcoded green
        "--glow-rgb": `${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}`,
    };
}

/**
 * The same variables as a `:root` rule, for injection via a `<style>` tag.
 *
 * Needed because dialogs, sheets and toasts render through a portal attached to
 * `document.body` — outside the dashboard wrapper — so a `style` prop on that
 * wrapper alone would leave every modal in the default green. The rule is only
 * mounted by the dashboard layout, so it disappears the moment the admin leaves
 * the panel and the public site is never affected.
 *
 * Injection-safe by construction: every value here is produced by `turfThemeVars`
 * from `normalizeAccent`, which returns either a generated `#rrggbb` string or
 * null — arbitrary text from the database can never reach the stylesheet.
 *
 * @param   {string|null} themeColor
 * @returns {string} CSS text, or "" when the default palette should be used
 */
export function turfThemeCss(themeColor) {
    const vars = turfThemeVars(themeColor);
    if (!vars) return "";
    const body = Object.entries(vars)
        .map(([k, v]) => `${k}:${v};`)
        .join("");
    return `:root{${body}}`;
}
