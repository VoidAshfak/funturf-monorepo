# Funturf Design System

## 1. Visual Theme & Atmosphere

Funturf's design system embodies energy, competition, and community. The bold green foundation evokes fresh turf and the thrill of the game, while a deep black base and crisp white content surfaces deliver a premium, high-contrast aesthetic inspired by modern sports and gaming platforms. Layered on top is a refined **green-tinted glass aesthetic** — inspired by Apple's translucent "Liquid Glass" design language — where menu bars, cards, and floating elements appear as frosted, backdrop-blurred panels that let the dark turf-green ambiance glow through. The design celebrates athleticism, matchmaking, and local sporting culture — projecting confidence, action, and team spirit. Rich, dynamic layouts with strong typographic hierarchy, purposeful color contrast, and luminous translucency create a platform that feels both exciting and premium. The system is built for action-oriented users who want to book a field, find players, or arrange a match with minimal friction.

**Key Characteristics**
- Deep black surfaces anchored by vivid greens for maximum energy and contrast
- **Green-tinted frosted glass surfaces** (backdrop blur + translucency) used generously across nav bars, cards, modals, and floating elements
- Layered depth where blurred glass panels float above a dark, ambient background
- Sharp, confident typography balanced by generous whitespace for clarity
- Sport-inspired color hierarchy — green signals action, white signals content, black signals depth, glass signals elevation
- Dynamic layouts with bold headings and clear call-to-action flows
- Consistent rounded corners that soften without sacrificing confidence
- Mobile-first interaction model with fully adaptive desktop and tablet layouts

---

## 2. Color Palette & Roles

### Primary
- **Funturf Green** (`#1DB954`): Core brand identity, hero CTAs, active states, and primary emphasis. The dominant action color
- **Funturf Green Light** (`#25D366`): Hover states, highlights, and secondary emphasis on green surfaces
- **Funturf Green Dark** (`#158A3E`): Pressed/active states, dark-mode green, and depth variants
- **Funturf Green Muted** (`#0F6B30`): Subtle green accents, background tints on dark surfaces

### Backgrounds & Surfaces
- **Pitch Black** (`#0A0A0A`): Primary page/app background; creates the deep, immersive feel
- **Dark Surface** (`#121212`): Card backgrounds, nav bar, and elevated containers on dark pages
- **Dark Surface Alt** (`#1A1A1A`): Secondary surface; sidebars, panels, grouped sections
- **Dark Elevated** (`#242424`): Raised cards, dropdowns, modals on dark backgrounds
- **White** (`#FFFFFF`): Primary text on dark surfaces; light-mode content surfaces
- **Off White** (`#F5F5F5`): Subtle light-mode background alternative; input fields on light sections
- **Cream Surface** (`#FAFAFA`): Light-mode card backgrounds and form areas

### Glass Surfaces (Green-Tinted Translucency)
These are the signature surfaces of Funturf — frosted, backdrop-blurred panels with a subtle green tint. Always pair the listed background with the corresponding `backdrop-filter` blur. Use generously: nav bars, primary cards, floating panels, modals, and badges should default to glass.
- **Glass Green Subtle** (`rgba(29, 185, 84, 0.06)` + `backdrop-filter: blur(20px)`): Default card and panel glass; barely-there green tint
- **Glass Green Medium** (`rgba(29, 185, 84, 0.12)` + `backdrop-filter: blur(24px)`): Nav bars, featured cards, active surfaces; more visible green glow
- **Glass Green Strong** (`rgba(29, 185, 84, 0.18)` + `backdrop-filter: blur(30px)`): Hero overlays, highlighted booking panels, primary glass CTAs
- **Glass Dark** (`rgba(18, 18, 18, 0.55)` + `backdrop-filter: blur(20px)`): Neutral frosted glass for content-heavy panels where green tint would distract
- **Glass White** (`rgba(255, 255, 255, 0.08)` + `backdrop-filter: blur(16px)`): Light frosted chips, secondary buttons, subtle dividers over imagery
- **Glass Border** (`1px solid rgba(255, 255, 255, 0.12)`): Standard hairline edge that defines every glass panel
- **Glass Border Green** (`1px solid rgba(29, 185, 84, 0.35)`): Active/hovered/focused glass edge
- **Glass Inner Highlight** (`inset 0 1px 0 rgba(255, 255, 255, 0.1)`): Top inner highlight that gives glass its lit, refractive edge

### Accent Colors
- **Lime Accent** (`#A8FF3E`): High-energy highlight; badges, scoreboard accents, live indicators
- **Turf Teal** (`#00C9A7`): Trust-building secondary actions; player verified status, safe-play indicators
- **Alert Amber** (`#FFB800`): Warnings, booking caution states, match-pending indicators

### Neutral Scale
- **Text Primary (Dark BG)** (`#FFFFFF`): Headings and body text on dark surfaces
- **Text Secondary (Dark BG)** (`#A0A0A0`): Subtext, labels, reduced-prominence copy on dark surfaces
- **Text Tertiary (Dark BG)** (`#666666`): Captions and helper text on dark surfaces
- **Text Primary (Light BG)** (`#0A0A0A`): Headings and body text on white/light surfaces
- **Text Secondary (Light BG)** (`#444444`): Subtext on white sections
- **Text Muted (Light BG)** (`#6B6B6B`): Captions and helper text on light sections

### Borders & Dividers
- **Border Dark** (`rgba(255, 255, 255, 0.08)`): Subtle dividers on dark surfaces
- **Border Green** (`rgba(29, 185, 84, 0.3)`): Green-tinted borders for active/focused elements
- **Border Light** (`#E0E0E0`): Dividers on white/light surfaces

### Semantic / Status
- **Success** (`#1DB954`): Confirmed bookings, successful matches, payment success
- **Error / Danger** (`#E53935`): Booking failures, validation errors, cancellations
- **Warning** (`#FFB800`): Pending states, match conflicts, low availability alerts
- **Info** (`#29B6F6`): Informational tooltips, schedule details, player stats

---

## 3. Typography Rules

### Font Family
**Primary:** `Inter` (sans-serif), fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`

**Display / Impact:** `Inter` with tight tracking and heavy weight; optionally pair with `Barlow Condensed` for scoreboard/stat contexts

### Hierarchy

| Role | Size (Desktop) | Size (Tablet) | Size (Mobile) | Weight | Line Height | Notes |
|------|---------------|--------------|--------------|--------|-------------|-------|
| **Display / Hero** | `72px` | `52px` | `36px` | `800` | `1.0×` | Maximum impact; hero headlines only |
| **Heading 1** | `48px` | `36px` | `28px` | `700` | `1.1×` | Page section titles |
| **Heading 2** | `32px` | `26px` | `22px` | `700` | `1.2×` | Subsection headings |
| **Heading 3** | `22px` | `20px` | `18px` | `600` | `1.3×` | Card titles, group headings |
| **Body Large** | `18px` | `17px` | `16px` | `400` | `1.6×` | Introductory paragraphs, feature descriptions |
| **Body Regular** | `16px` | `15px` | `15px` | `400` | `1.55×` | Standard body copy |
| **Body Small** | `14px` | `14px` | `13px` | `400` | `1.5×` | Captions, meta info, timestamps |
| **Button / Label** | `16px` | `15px` | `15px` | `600` | `1.25×` | CTAs, nav items, labels |
| **Stat / Score** | `40px` | `32px` | `24px` | `800` | `1.0×` | Scores, counters, match timers |

### Principles
- **Weight contrast:** 400 for body, 600 for buttons/labels, 700–800 for headings; never skip more than one level in hierarchy
- **Responsive scaling:** Typography scales down meaningfully at each breakpoint — do not use the same size across all viewports
- **Case rules:** Title Case for headings; Sentence case for body and labels; ALL CAPS only for short badges/tags
- **Color on dark:** Always use `#FFFFFF` or `#A0A0A0` text on dark backgrounds; never use pure green for body text
- **Legibility first:** WCAG AA minimum for all text/background combinations

---

## 4. Component Stylings

### Buttons

#### Primary Button (Green CTA)
- **Background:** `#1DB954`
- **Text Color:** `#0A0A0A`
- **Padding:** `14px 28px` (desktop/tablet) / `13px 20px` (mobile)
- **Border Radius:** `8px`
- **Border:** `none`
- **Font Size:** `16px` (desktop/tablet) / `15px` (mobile)
- **Font Weight:** `600`
- **Height:** `52px` (desktop/tablet) / `50px` (mobile)
- **Hover State:** Background `#25D366`, slight scale `1.02`
- **Active State:** Background `#158A3E`
- **Focus State:** `box-shadow: 0 0 0 3px rgba(29, 185, 84, 0.35)`

#### Secondary Button (Dark Outlined)
- **Background:** `transparent`
- **Text Color:** `#1DB954`
- **Padding:** `13px 26px` (desktop/tablet) / `12px 18px` (mobile)
- **Border Radius:** `8px`
- **Border:** `2px solid #1DB954`
- **Font Size:** `16px` (desktop/tablet) / `15px` (mobile)
- **Font Weight:** `600`
- **Height:** `52px` (desktop/tablet) / `50px` (mobile)
- **Hover State:** Background `rgba(29, 185, 84, 0.1)`
- **Active State:** Background `rgba(29, 185, 84, 0.2)`

#### Glass Button (Frosted)
- **Background:** `rgba(29, 185, 84, 0.12)`
- **Backdrop Filter:** `blur(16px) saturate(1.3)`
- **Text Color:** `#FFFFFF`
- **Padding:** `13px 24px`
- **Border Radius:** `8px`
- **Border:** `1px solid rgba(255, 255, 255, 0.18)`
- **Box Shadow:** `inset 0 1px 0 rgba(255, 255, 255, 0.12)`
- **Font Size:** `16px`
- **Font Weight:** `600`
- **Height:** `52px`
- **Hover State:** Background `rgba(29, 185, 84, 0.2)`, border `1px solid rgba(29, 185, 84, 0.4)`
- **Active State:** Background `rgba(29, 185, 84, 0.1)`
- **Use:** Secondary actions floating over hero imagery, filters, and toolbar controls

#### Danger Button
- **Background:** `#E53935`
- **Text Color:** `#FFFFFF`
- **Padding:** `14px 28px`
- **Border Radius:** `8px`
- **Font Weight:** `600`
- **Height:** `52px`
- **Hover State:** Background `#C62828`

---

### Cards & Containers

> **Glass default:** Funturf cards are glass surfaces. Combine the background tint with a `backdrop-filter` blur, a hairline glass border, and the inner highlight to achieve the frosted, refractive look. Fall back to solid `#1A1A1A` only where backdrop-blur is unsupported.

#### Turf Booking Card (Glass)
- **Background:** `rgba(29, 185, 84, 0.06)`
- **Backdrop Filter:** `blur(20px) saturate(1.2)`
- **Padding:** `24px` (desktop) / `20px` (tablet) / `16px` (mobile)
- **Border Radius:** `16px`
- **Border:** `1px solid rgba(255, 255, 255, 0.12)`
- **Box Shadow:** `0 8px 32px rgba(0, 0, 0, 0.4)`, inner highlight `inset 0 1px 0 rgba(255, 255, 255, 0.1)`
- **Width:** Responsive (see Grid section)
- **Hover State:** Background `rgba(29, 185, 84, 0.12)`, border `1px solid rgba(29, 185, 84, 0.35)`, shadow gains green glow `0 8px 32px rgba(29, 185, 84, 0.18)`

#### Player Profile Card (Glass)
- **Background:** `rgba(29, 185, 84, 0.06)`
- **Backdrop Filter:** `blur(20px) saturate(1.2)`
- **Padding:** `20px`
- **Border Radius:** `16px`
- **Border:** `1px solid rgba(255, 255, 255, 0.12)`
- **Box Shadow:** `0 8px 32px rgba(0, 0, 0, 0.4)`, inset `0 1px 0 rgba(255, 255, 255, 0.1)`
- **Avatar Size:** `56px` × `56px` (desktop) / `48px` × `48px` (mobile), fully rounded `1000px`
- **Hover State:** Border `1px solid rgba(29, 185, 84, 0.35)`

#### Match Card (Strong Glass)
- **Background:** `rgba(29, 185, 84, 0.14)`
- **Backdrop Filter:** `blur(28px) saturate(1.3)`
- **Padding:** `24px`
- **Border Radius:** `16px`
- **Border:** `1px solid rgba(29, 185, 84, 0.3)`
- **Box Shadow:** `0 8px 32px rgba(0, 0, 0, 0.35)`, green glow `0 0 24px rgba(29, 185, 84, 0.15)`, inset `0 1px 0 rgba(255, 255, 255, 0.12)`

#### Neutral Glass Panel (content-heavy)
- **Background:** `rgba(18, 18, 18, 0.55)`
- **Backdrop Filter:** `blur(20px)`
- **Padding:** `24px`
- **Border Radius:** `16px`
- **Border:** `1px solid rgba(255, 255, 255, 0.1)`
- **Box Shadow:** `0 8px 32px rgba(0, 0, 0, 0.4)`
- **Use:** Schedule lists, settings panels, and dense data where green tint would reduce readability

#### Light Content Container (for white sections)
- **Background:** `#FFFFFF`
- **Padding:** `48px 60px` (desktop) / `32px 40px` (tablet) / `24px 16px` (mobile)
- **Border Radius:** `16px`
- **Border:** `1px solid #E0E0E0`

---

### Inputs & Forms

#### Text Input (Dark Surface)
- **Background:** `#242424`
- **Text Color:** `#FFFFFF`
- **Border:** `1px solid rgba(255, 255, 255, 0.12)`
- **Border Radius:** `8px`
- **Padding:** `12px 16px`
- **Font Size:** `15px` (all breakpoints)
- **Font Weight:** `400`
- **Line Height:** `1.5`
- **Placeholder Color:** `#666666`
- **Focus State:** Border `1px solid #1DB954`, box-shadow `0 0 0 3px rgba(29, 185, 84, 0.2)`
- **Error State:** Border `1px solid #E53935`, box-shadow `0 0 0 3px rgba(229, 57, 53, 0.15)`

#### Text Input (Light Surface)
- **Background:** `#F5F5F5`
- **Text Color:** `#0A0A0A`
- **Border:** `1px solid #E0E0E0`
- **Border Radius:** `8px`
- **Padding:** `12px 16px`
- **Focus State:** Border `1px solid #1DB954`, box-shadow `0 0 0 3px rgba(29, 185, 84, 0.15)`

#### Form Label
- **Font Size:** `14px`
- **Font Weight:** `600`
- **Color:** `#A0A0A0` (dark surface) / `#444444` (light surface)
- **Margin Bottom:** `6px`
- **Display:** `block`
- **Text Transform:** uppercase, letter-spacing `0.05em`

---

### Navigation

> **Glass default:** All Funturf nav bars are frosted glass — translucent green-tinted backgrounds with a strong backdrop blur so content scrolls luminously beneath them.

#### Desktop Navigation Bar (Glass)
- **Background:** `rgba(29, 185, 84, 0.08)` over `rgba(10, 10, 10, 0.6)` base
- **Backdrop Filter:** `blur(24px) saturate(1.4)`
- **Height:** `64px`
- **Padding:** `0 48px`
- **Display:** `flex`, align-items center, justify-content space-between
- **Border Bottom:** `1px solid rgba(255, 255, 255, 0.1)`
- **Box Shadow:** `inset 0 -1px 0 rgba(255, 255, 255, 0.06)`
- **Position:** `sticky`/`fixed` top so glass blur reveals scrolling content beneath
- **Logo:** Funturf wordmark in `#1DB954`, 24px / 700 weight

#### Tablet Navigation Bar (Glass)
- **Background:** `rgba(29, 185, 84, 0.08)` over `rgba(10, 10, 10, 0.6)` base
- **Backdrop Filter:** `blur(24px) saturate(1.4)`
- **Height:** `56px`
- **Padding:** `0 24px`
- **Shows:** Logo + primary CTAs only; other links collapse to hamburger

#### Mobile Navigation Bar (Glass)
- **Background:** `rgba(29, 185, 84, 0.08)` over `rgba(10, 10, 10, 0.65)` base
- **Backdrop Filter:** `blur(20px) saturate(1.3)`
- **Height:** `52px`
- **Padding:** `0 16px`
- **Shows:** Logo + hamburger icon; all links in a full-screen glass slide-out drawer

#### Navigation Item (Link)
- **Color:** `#A0A0A0`
- **Font Size:** `15px`
- **Font Weight:** `500`
- **Padding:** `0 14px`
- **Hover State:** Color `#FFFFFF`
- **Active State:** Color `#1DB954`, border-bottom `2px solid #1DB954`

#### Bottom Tab Bar (Mobile only — Glass)
- **Background:** `rgba(18, 18, 18, 0.7)` with green tint `rgba(29, 185, 84, 0.05)`
- **Backdrop Filter:** `blur(24px) saturate(1.3)`
- **Height:** `60px` + safe-area-inset-bottom
- **Border Top:** `1px solid rgba(255, 255, 255, 0.1)`
- **Icons:** 24px × 24px; inactive `#666666`, active `#1DB954`
- **Labels:** 10px / 500; inactive `#666666`, active `#1DB954`

---

### Badges & Tags

#### Active / Live Badge
- **Background:** `#A8FF3E`
- **Text Color:** `#0A0A0A`
- **Padding:** `4px 12px`
- **Border Radius:** `1000px`
- **Font Size:** `12px`
- **Font Weight:** `700`
- **Text Transform:** uppercase

#### Sport Tag (Glass)
- **Background:** `rgba(29, 185, 84, 0.15)`
- **Backdrop Filter:** `blur(12px)`
- **Text Color:** `#1DB954`
- **Padding:** `5px 12px`
- **Border Radius:** `6px`
- **Border:** `1px solid rgba(29, 185, 84, 0.25)`
- **Font Size:** `13px`
- **Font Weight:** `600`

#### Player Skill Badge (Glass)
- **Background:** `rgba(255, 255, 255, 0.08)`
- **Backdrop Filter:** `blur(12px)`
- **Text Color:** `#A0A0A0`
- **Border:** `1px solid rgba(255, 255, 255, 0.12)`
- **Padding:** `5px 12px`
- **Border Radius:** `6px`
- **Font Size:** `13px`
- **Font Weight:** `500`

---

## 5. Layout Principles

### Spacing System

**Base Unit:** `8px`

**Scale:** `4px`, `8px`, `12px`, `16px`, `20px`, `24px`, `32px`, `40px`, `48px`, `60px`, `80px`, `120px`

**Usage Context:**
- `4px`: Micro-gaps, icon-to-label spacing
- `8px`: Tight inner component spacing
- `12px`: Compact padding within small components
- `16px`: Standard component padding; mobile container padding
- `20px`: Medium component gap
- `24px`: Card padding (mobile), column gap (tablet)
- `32px`: Card padding (desktop), section inner padding
- `40px`: Section spacing (mobile)
- `48px`: Section spacing (tablet), inter-section rhythm
- `60px`: Section spacing (desktop)
- `80px`: Major section separation (desktop)
- `120px`: Hero vertical padding (desktop)

---

### Grid & Container

**Max Content Width:** `1280px`

**Container Horizontal Padding:**
- Desktop: `60px` each side (or auto-centered with max-width)
- Tablet: `32px` each side
- Mobile: `16px` each side

**Column Strategy:**

| Context | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Turf listing cards | 3 columns, `24px` gap | 2 columns, `20px` gap | 1 column, full width |
| Player profile cards | 4 columns, `20px` gap | 2 columns, `20px` gap | 2 columns, `12px` gap |
| Match cards | 2 columns, `24px` gap | 1 column, full width | 1 column, full width |
| Feature highlights | 3 columns, `32px` gap | 2 columns, `24px` gap | 1 column, full width |
| Stats / counters | 4 columns, `16px` gap | 4 columns, `12px` gap | 2 columns, `12px` gap |

**Section Patterns:**
- Hero: Full viewport width, centered text, `120px` vertical padding (desktop) / `80px` (tablet) / `60px` (mobile)
- Content sections: Max-width container, centered, alternating image/text layouts on desktop; stacked on mobile
- Card grids: Responsive CSS grid, cards fill available width; maintain consistent gap
- Full-bleed: Background extends edge-to-edge; content stays within max-width container

---

### Whitespace Philosophy

Funturf embraces bold whitespace — particularly on dark backgrounds — to let green accents breathe and guide the eye. Generous padding around CTAs builds confidence and reduces accidental taps. Tight, card-dense sections are broken up by breathing spacer sections. Whitespace is not empty — it creates rhythm, urgency, and focus.

---

### Border Radius Scale

- `0px`: Full-bleed backgrounds, image fills
- `4px`: Small tags, tight UI chips
- `6px`: Sport tags, skill badges, small inputs
- `8px`: Standard inputs, buttons, icon containers
- `12px`: Cards, panels, modals
- `16px`: Large content containers, image overlays
- `24px`: Hero image frames, large featured cards
- `1000px`: Avatars, pill badges, fully-rounded chips

---

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| **Level 0 (Base)** | No shadow | Page background, flat dark surfaces |
| **Level 1 (Raised)** | `box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35)` | Standard cards on dark backgrounds |
| **Level 2 (Floating)** | `box-shadow: 0 4px 24px rgba(0, 0, 0, 0.5)` | Active/hovered cards, floating panels |
| **Level 3 (Modal)** | `box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7)` | Dialogs, drawers, full overlays |
| **Level 4 (Maximum)** | `box-shadow: 0 24px 64px rgba(0, 0, 0, 0.85)` | Top-level modals, fullscreen overlays |
| **Green Glow** | `box-shadow: 0 0 20px rgba(29, 185, 84, 0.25)` | Featured CTAs, active booking states |
| **Glass Float** | `0 8px 32px rgba(0, 0, 0, 0.4)` + `inset 0 1px 0 rgba(255,255,255,0.1)` | All glass cards and panels — combines outer depth with inner top highlight |

**Shadow Philosophy:** Shadows are heavier on dark backgrounds to create meaningful depth. The system favors deep `rgba(0,0,0,...)` shadows over colored ones, reserving the green glow effect for high-emphasis interactive moments only. Glass surfaces pair an outer drop shadow with an inset top highlight — the highlight is what gives glass its lit, refractive edge and must never be omitted.

---

## 6.5 Glass System (Signature Style)

Funturf's defining visual trait is **green-tinted frosted glass**. Translucent, backdrop-blurred panels float above the dark background, picking up a subtle turf-green glow. This should appear consistently and generously across the product — slightly more than a typical glassmorphism implementation — but never so much that the interface loses contrast or legibility.

### The Glass Recipe

Every glass surface is built from four layers stacked together:

1. **Translucent tinted background** — e.g. `rgba(29, 185, 84, 0.06–0.18)` for green glass, or `rgba(18, 18, 18, 0.55)` for neutral glass
2. **Backdrop blur** — `backdrop-filter: blur(16px–30px) saturate(1.2–1.4)`; the saturate boost makes the green ambiance richer
3. **Hairline border** — `1px solid rgba(255, 255, 255, 0.12)` (neutral) or `rgba(29, 185, 84, 0.35)` (active)
4. **Inner top highlight** — `inset 0 1px 0 rgba(255, 255, 255, 0.1)` to simulate light catching the top edge

```css
/* Reference: standard Funturf glass card */
.glass-card {
  background: rgba(29, 185, 84, 0.06);
  backdrop-filter: blur(20px) saturate(1.2);
  -webkit-backdrop-filter: blur(20px) saturate(1.2);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4),
              inset 0 1px 0 rgba(255, 255, 255, 0.1);
}
```

### Where to Use Glass (generously)

- **Always glass:** Top nav bars, bottom tab bar, mobile drawer, turf cards, player cards, match cards, modals, dropdowns, toast notifications, filter chips, floating action buttons
- **Often glass:** Sport tags, skill badges, secondary buttons, search bars, sidebar panels
- **Strong glass (more tint/blur):** Hero overlays, featured booking panels, live-match highlight cards

### Where NOT to Use Glass

- **Primary green CTA buttons** — keep these solid `#1DB954` so the main action stays high-contrast and unmistakable
- **Body text containers with dense reading** — use Neutral Glass (`rgba(18,18,18,0.55)`) instead of green glass so tint doesn't reduce legibility
- **Over busy/high-frequency imagery** without darkening the layer beneath — text on glass must still pass WCAG AA
- **Light-mode white sections** — glass is a dark-surface effect; revert to solid white cards in light areas

### Blur Intensity Scale

| Token | Blur | Use |
|-------|------|-----|
| **Glass Light** | `blur(12px)` | Small chips, tags, badges |
| **Glass Standard** | `blur(20px) saturate(1.2)` | Cards, panels — the default |
| **Glass Heavy** | `blur(24px) saturate(1.4)` | Nav bars, sticky/fixed elements |
| **Glass Max** | `blur(30px) saturate(1.4)` | Full-screen modals, drawers, hero overlays |

### Performance & Fallbacks

- Always include the `-webkit-backdrop-filter` prefix alongside `backdrop-filter`
- Provide a solid fallback (`#1A1A1A` for cards, `rgba(10,10,10,0.95)` for nav) using `@supports not (backdrop-filter: blur(1px))`
- Avoid stacking more than 2–3 blurred layers in the same view — backdrop-filter is GPU-expensive; on long scrolling lists, apply glass to the container, not every row
- On mobile, cap blur at `blur(24px)` to preserve scroll performance

---

## 7. Do's and Don'ts

### Do
- **Use green-tinted frosted glass generously** across nav bars, cards, modals, drawers, and floating elements — it's Funturf's signature look
- **Always build glass from all four layers** — tinted translucent background, backdrop blur, hairline border, and inner top highlight
- **Pair every glass surface with the inner highlight** (`inset 0 1px 0 rgba(255,255,255,0.1)`) to give it a lit, refractive edge
- **Make nav bars sticky/fixed** so the backdrop blur reveals content scrolling beneath — this is what makes glass feel alive
- **Use Funturf Green (`#1DB954`) as the primary action color** — CTAs, active states, confirmed bookings, and navigation highlights
- **Maintain deep black (`#0A0A0A`) as the dominant background** for all primary screens and app surfaces
- **Use white (`#FFFFFF`) for text on dark and glass surfaces** to guarantee readability and contrast
- **Add the `-webkit-backdrop-filter` prefix and a solid fallback** for every glass surface
- **Scale typography at every breakpoint** — hero text must reduce meaningfully from desktop to mobile
- **Maintain minimum 48px touch targets** for all interactive elements; prefer 52px+ for primary actions
- **Use `#A0A0A0` for secondary text** on dark surfaces — never use pure white for secondary copy
- **Apply bottom tab bar on mobile** for primary navigation (Book, Find Players, Matches, Profile)
- **Leverage the 8px spacing scale** for consistent rhythm across all layouts
- **Use Lime Accent (`#A8FF3E`) sparingly** — only for live indicators, urgency badges, and score highlights

### Don't
- **Don't apply glass to primary green CTA buttons** — keep those solid `#1DB954` so the main action stays unmistakable
- **Don't use green-tinted glass over dense reading text** — switch to Neutral Glass (`rgba(18,18,18,0.55)`) so the tint doesn't hurt legibility
- **Don't stack more than 2–3 blurred layers in one view** — backdrop-filter is GPU-expensive and will hurt scroll performance
- **Don't omit the glass border or inner highlight** — without them, glass looks like flat translucency, not Apple-style glass
- **Don't let glass drop below WCAG AA contrast** — darken the layer beneath busy imagery before placing text on glass
- **Don't use green as a body text color** — reserve it for interactive elements and status indicators only
- **Don't use glass in light-mode white sections** — revert to solid white cards there
- **Don't use pure `#000000` black for text** — use `#0A0A0A` or dark surfaces as background only
- **Don't hardcode `text-white`/`text-black` (or white/black gradient stops) on theme-adaptive surfaces** — cards, glass panels and any surface that flips between light and dark must use the `foreground`/`muted-foreground` tokens (or a mid-tone brand gradient like green→teal that reads on both). Fixed white text vanishes on light cards; fixed dark text vanishes on dark cards. White text is only safe on **always-dark** surfaces (the hero band, solid green/colored CTAs, image overlays with a dark scrim)
- **Don't use yellow/amber for primary actions** — `#FFB800` is strictly for warning states
- **Don't override the Inter font stack** — no display fonts outside of marketing hero sections
- **Don't collapse desktop navigation to hamburger until tablet breakpoint** — at 768px, not below
- **Don't apply green glow to every element** — overuse destroys its emphasis value
- **Don't use small text (below 13px) on any surface** — readability is non-negotiable at all screen sizes
- **Don't use asymmetric spacing** outside the 8px scale; always use defined scale multiples

---

## 8. Responsive Behavior

### Breakpoints

| Name | Width Range | Layout Strategy |
|------|-------------|-----------------|
| **Mobile** | `320px – 767px` | Single column; stacked layouts; bottom tab bar; 16px container padding; hamburger drawer |
| **Tablet** | `768px – 1199px` | 2-column grids; condensed nav bar (logo + CTA); 32px container padding; side drawer or condensed top nav |
| **Desktop** | `1200px+` | 3–4 column grids; full horizontal nav; 60px container padding; max-width 1280px centered |

---

### Breakpoint Details

#### Mobile (`320px – 767px`)
- **Navigation:** Bottom tab bar (Book, Players, Matches, Profile) + top bar with logo and hamburger for secondary nav
- **Grids:** Single column, full width cards; 2-column only for player profile thumbnails
- **Typography:** Hero 36px / H1 28px / H2 22px / Body 15px
- **Container Padding:** `16px`
- **Section Vertical Padding:** `48px`
- **Hero Height:** 70vh minimum
- **Card Padding:** `16px`
- **Button Height:** `50px`, full-width for primary CTAs
- **Form Inputs:** Full-width stacked fields
- **Touch Targets:** Minimum `48px` × `48px`; primary actions `52px`

#### Tablet (`768px – 1199px`)
- **Navigation:** Top bar with logo, abbreviated links (Book, Find, Matches), and profile avatar; secondary links in hamburger slide-out
- **Grids:** 2-column for turf cards and features; 2-column for player cards
- **Typography:** Hero 52px / H1 36px / H2 26px / Body 15–16px
- **Container Padding:** `32px`
- **Section Vertical Padding:** `64px`
- **Hero Height:** 75vh
- **Card Padding:** `20px`
- **Button Height:** `52px`; full-width only in modals and forms
- **Form Inputs:** 2-column layout for paired fields (name + phone, start time + end time)

#### Desktop (`1200px+`)
- **Navigation:** Full horizontal nav bar with all links; logo left, links center/right, auth buttons far right
- **Grids:** 3-column turf cards; 4-column player cards; 2-column match cards
- **Typography:** Hero 72px / H1 48px / H2 32px / Body 16–18px
- **Container Padding:** `60px` (or centered with max-width)
- **Section Vertical Padding:** `80–120px`
- **Hero Height:** 85vh or full viewport
- **Card Padding:** `24px`
- **Button Height:** `52px`; auto-width (fit content)
- **Form Inputs:** Multi-column form layouts; label + input in rows

---

### Touch Targets

- **Minimum Size:** `48px` × `48px` for all interactive elements across all viewports
- **Primary CTAs:** `52px` height minimum
- **Bottom Tab Bar (Mobile):** Each tab minimum `64px` tap zone height
- **Spacing:** Minimum `8px` gap between adjacent interactive targets
- **Icon Buttons:** `24px` icon inside `48px` tap zone

---

### Collapsing Strategy

| Element | Desktop | Tablet | Mobile |
|---------|---------|--------|--------|
| Navigation | Full horizontal bar | Condensed top bar + hamburger | Logo top bar + bottom tab bar |
| Turf Card Grid | 3 columns | 2 columns | 1 column |
| Player Card Grid | 4 columns | 2 columns | 2 columns (compact) |
| Hero Typography | 72px | 52px | 36px |
| Container Padding | 60px | 32px | 16px |
| Section Spacing | 80–120px | 64px | 48px |
| Card Padding | 24px | 20px | 16px |
| Button Width | Fit content | Fit content | Full width (primary only) |
| Form Layout | Multi-column | 2-column | Single column |
| Hero Height | 85vh | 75vh | 70vh |

---

## 9. Agent Prompt Guide

### Quick Color Reference

- **Primary CTA Background:** `#1DB954` (Funturf Green); text `#0A0A0A`
- **Secondary CTA:** Outlined green — `transparent` bg, `#1DB954` text + border
- **Card Background:** Green glass `rgba(29, 185, 84, 0.06)` + `backdrop-filter: blur(20px) saturate(1.2)`
- **Nav Bar:** Green glass `rgba(29, 185, 84, 0.08)` over `rgba(10,10,10,0.6)` + `blur(24px) saturate(1.4)`
- **Neutral Glass Panel:** `rgba(18, 18, 18, 0.55)` + `blur(20px)`
- **Glass Border:** `1px solid rgba(255, 255, 255, 0.12)` (neutral) / `rgba(29, 185, 84, 0.35)` (active)
- **Glass Inner Highlight:** `inset 0 1px 0 rgba(255, 255, 255, 0.1)`
- **Page Background:** `#0A0A0A` (Pitch Black)
- **Elevated Surface:** `#242424` (Dark Elevated)
- **Heading Text (dark bg):** `#FFFFFF`
- **Body Text (dark bg):** `#FFFFFF` at 400 weight
- **Secondary Text (dark bg):** `#A0A0A0`
- **Borders (dark):** `rgba(255, 255, 255, 0.08)`
- **Active/Hover Border:** `rgba(29, 185, 84, 0.4)`
- **Error States:** `#E53935`
- **Warning / Pending:** `#FFB800`
- **Live / Urgent Badge:** `#A8FF3E` bg, `#0A0A0A` text
- **Verified / Safe:** `#00C9A7`
- **Focus Ring:** `0 0 0 3px rgba(29, 185, 84, 0.3)`
- **Green Glow:** `0 0 20px rgba(29, 185, 84, 0.25)`

---

### Iteration Guide

1. **Always apply the 8px spacing scale** — use `8`, `16`, `24`, `32`, `48`, `60`, `80`, `120px` for all margins, padding, and gaps; no arbitrary values

2. **Typography scales across all three breakpoints** — never use the same font size for mobile and desktop; refer to the hierarchy table for each breakpoint size

3. **Primary green (`#1DB954`) is for action only** — CTAs, active nav items, form focus states, confirmed/success indicators; never use for body text or decorative fills

4. **Cards and panels default to green glass** — `rgba(29,185,84,0.06)` background + `backdrop-filter: blur(20px) saturate(1.2)` + hairline border + inner highlight; use Neutral Glass (`rgba(18,18,18,0.55)`) for dense-text panels and solid white only in light-mode sections

4b. **Glass is the signature style — use it generously** — nav bars, cards, modals, drawers, tabs, chips, and floating elements should all be frosted glass; aim for slightly more glass than a typical implementation, but never at the cost of contrast. Always include `-webkit-backdrop-filter` and a solid fallback via `@supports`

5. **Buttons scale responsively** — `52px` height on desktop/tablet; `50px` on mobile; primary CTAs go full-width on mobile only

6. **Navigation pattern changes per breakpoint** — full horizontal (desktop) → condensed + hamburger (tablet) → logo top bar + bottom tabs (mobile); never collapse desktop nav on desktop

7. **Touch targets are non-negotiable** — `48px` minimum on all viewports; `52px` for primary actions; `64px` tap zones for bottom tab bar

8. **Shadows are heavier on dark surfaces** — use Level 1 (`0 2px 8px rgba(0,0,0,0.35)`) for standard cards; reserve green glow for featured/active elements only

9. **Green glow is a premium accent** — apply `box-shadow: 0 0 20px rgba(29, 185, 84, 0.25)` to primary CTA buttons and featured booking cards only; do not apply globally

10. **Maintain strict contrast** — `#FFFFFF` on `#0A0A0A` always passes; `#A0A0A0` on `#1A1A1A` should be tested for WCAG AA; `#0A0A0A` on `#1DB954` passes for button labels
