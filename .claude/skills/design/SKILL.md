---
name: design
description: Frontend design system for funturf (sports-community turf app). Use when building or restyling any UI — pages, sections, cards, forms, hero, nav — or when adding GSAP animation. Points to the canonical spec and adds the motion layer so every screen stays consistent.
---

# funturf Design Skill

## Canonical spec lives in `docs/DESIGN.md`

**Read `docs/DESIGN.md` before styling anything.** It is the single source of truth for colors, the glass system, typography, components, spacing, layout, elevation, and responsive behavior. Do not invent values — pull them from there. This skill only summarizes + adds the motion layer DESIGN.md omits.

### Non-negotiables (from DESIGN.md)
- **Dark-first.** Page background is Pitch Black `#0A0A0A`. Not a light theme.
- **Green-tinted frosted glass is the signature.** Nav bars, cards, modals, drawers, chips → glass: tinted translucent bg + `backdrop-filter: blur() saturate()` + hairline border + `inset 0 1px 0 rgba(255,255,255,0.1)` top highlight. Always add `-webkit-backdrop-filter` + a solid `@supports` fallback.
- **Funturf Green `#1DB954` = action only** (CTAs, active, success). Never body text. Primary CTA buttons stay **solid** green, never glass.
- **Font: Inter** (display weight 700–800). Current code uses Geist — migrate to Inter.
- **8px spacing scale**, typography scales per breakpoint, touch targets ≥48px (52px primary).
- Quick reference + agent guide: DESIGN.md §9.

### Product framing
Sports community — manage teams, find teammates, book turfs, organize/join events. Lead UI with community + matchmaking. JavaScript only (no `.ts`/`.tsx`). shadcn/ui + lucide.

## Motion layer (GSAP — free plugins only)

DESIGN.md has no motion section; this is it. Use `gsap` + `@gsap/react` `useGSAP` + `ScrollTrigger`. **Never** paid plugins (SplitText, MorphSVG). All recipes live in `src/lib/animations.js` — import them, don't hand-roll, so timing stays uniform.

Canonical pattern (client component):

```jsx
"use client";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { staggerOnScroll } from "@/lib/animations";

export default function VenueGrid({ children }) {
    const scope = useRef(null);
    useGSAP(() => {
        staggerOnScroll(".venue-card", scope.current);
    }, { scope });
    return <div ref={scope} className="card_grid">{children}</div>;
}
```

Recipes: `heroReveal` (landing intro), `staggerOnScroll` (card grids), `fadeUpOnScroll` (sections entering view), `hoverPop` (cards/buttons). Shared timing in `MOTION`. Tune the system in `animations.js`, never per-component magic numbers.

Rules:
- Animate inside `useGSAP(() => {...}, { scope })` — auto-cleanup.
- Respect `prefers-reduced-motion` — skip non-essential motion.
- Subtle entrances (lift + fade); save big motion + green glow for hero/featured.
- Glass + motion: animate transform/opacity, not blur (backdrop-filter animation is GPU-expensive).

## Server/client split
Data fetching stays in Server Components; wrap the rendered list in a thin `"use client"` grid that runs the GSAP recipe (see `VenueGrid.jsx`). Don't make the data layer client just to animate.

## Checklist when building a screen
1. Open `docs/DESIGN.md`, pull exact tokens.
2. Sports-community framing (teams / teammates / book / join).
3. Dark surface + green glass where the spec says glass; solid green for primary CTA.
4. Inter font, 8px spacing, per-breakpoint type scale, ≥48px targets.
5. GSAP entrance via a recipe from `src/lib/animations.js`.
6. JavaScript only, shadcn + lucide.
