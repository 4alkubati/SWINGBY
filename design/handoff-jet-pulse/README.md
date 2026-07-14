# Handoff: SwingBy Mobile UI Repolish ("Jet × Pulse" direction)

## Overview
This package documents a visual repolish of the SwingBy mobile app (React Native / Expo, `mobile/` in the monorepo). The chosen direction is **2a "Jet × Pulse"**: the existing dark token system executed with far more discipline — solid surfaces, square 12px buttons, purple reserved for actions and live states — plus selected "live energy" moments (glow headers, map preview, gradient earnings card).

The goal for Claude Code: **apply this direction across the whole app**, starting from the three specced screens (Home, Active Booking, Business Dashboard) and extending the same rules to every other screen.

## About the Design Files
The bundled files are **design references created in HTML** — they show intended look and behavior, not production code. Do NOT copy the HTML. Recreate the designs in the existing React Native codebase (`mobile/src/`) using its established components (`mobile/src/components/`), theme (`mobile/src/theme/tokens.js`, `typography.js`), and patterns.

- `SwingBy Polish.dc.html` — open in a browser. The **top section (badge 2a)** is the approved direction. Sections 1a/1b/1c below it are earlier explorations kept for reference (1a = structural base, 1b = source of the dashboard).
- `ios-frame.jsx`, `support.js` — supporting runtime for the HTML preview; ignore for implementation.

## Fidelity
**High-fidelity.** Colors, type sizes, spacing, radii, and copy in section 2a are intentional and should be matched closely (adapted to RN units).

## Global rules (apply everywhere, not just the 3 screens)
1. **No emoji as UI iconography.** Replace every emoji (🔔 📍 🔍, category emojis, etc.) with Feather icons (`@expo/vector-icons`, already a dependency), stroke width ~1.8, sizes 16–22.
2. **Purple discipline.** `accent #6E56F7` only for: primary CTAs, active nav state, live/pulse indicators, selected states. Everything else is neutral (`surface`/`border`/`textSecondary`). `accentText #8878F9` for purple text/links on dark.
3. **Money is green.** All earnings/price values use `success #2EBD85`.
4. **Type hierarchy.** Space Grotesk 700 with tight letter-spacing (−1px to −1.5px on 27–40px headings) for all headings and numerals; Inter for body. Screen heroes are BIG (e.g. "Hey Ali." 32px, "Arriving in 12 min" 27px, "$2,340" 40px).
5. **Surfaces.** Cards: `#0F1115` bg + 1px `#1F232B` border + 20px radius. Secondary/alt: `#161A21`. No glassmorphism except the two sanctioned gradient/glow moments below.
6. **Buttons are square-ish (12px radius), 44–52px tall.** Primary: solid `#6E56F7`, white 600 text. Secondary ("Pass" style): `#161A21` bg, `#1F232B` border, `#8B92A0` 600 text. Never pill-shaped buttons.
7. **Section headers**: 11px, weight 600, letter-spacing 1.4px, UPPERCASE, `#8B92A0`; optional right-aligned "See all" link in `#8878F9` 13px/600.
8. **Live states pulse.** A 8–9px `#6E56F7` dot with an expanding ring (RN: reanimated loop scaling a shadow ring, ~1.8s). Used on "ON THE WAY", live map pins, notification dot.
9. **Trust copy.** Surface escrow: "Payment releases only when you approve the work." (lock icon, caption size) on booking screens; "$180 · held in escrow" in green in detail rows.
10. **Sanctioned glow moments** (from Pulse): (a) faint radial purple glow behind screen headers — `radial-gradient(rgba(110,86,247,0.25)→transparent)`, absolutely positioned, pointer-events none; (b) the dashboard earnings gradient card (spec below).

## Screens / Views (section 2a in the HTML)

### 1. Client Home
- Header: "SwingBy" wordmark (Space Grotesk 700 21px, "By" in `#8878F9`) left; 38px circular bell button (surface bg, border) with 7px purple notification dot, top-right.
- Greeting: "Hey Ali." (32px SG 700, ls −1.2px); below, map-pin icon + "Calgary, AB · What needs doing?" (14px `#8B92A0`).
- Search field: 52px, radius 14, surface bg + border, search icon, placeholder `Try "deep clean saturday"` (15px `#8B92A0`).
- Category grid: 4 columns, 56px icon tiles (radius 16). Active tile: `#2A2247` bg + `#8878F9` icon + white label. Inactive: surface bg + border + `#8B92A0` icon/label. Categories: Cleaning, Plumbing, Moving, More (expand to full 8 in-app).
- **Map preview card**: 170px tall, radius 20, border; dark blue-tinted gradient (`160deg, #0D1017 → #101623 → #0E1320`) with a faint 34px grid overlay; 12px purple pin dots with soft rings (one green = top-rated); bottom overlay bar (radius 14, `rgba(10,11,14,0.78)`, border): "12 pros near you / Kensington · Calgary" + "Open map →" link in `#8878F9`. Tapping navigates to `NearbyMapScreen`.
- TOP RATED NEAR YOU section: featured card (radius 20) — 48px initials tile (`#2A2247` bg, `#8878F9` SG 700 text), name 15.5px/600 + green "Verified" pill (10.5px, `rgba(46,189,133,0.14)` bg), meta "★ 4.9 · 212 jobs · 1.2 km" (rating white/600, rest `#8B92A0`), chevron right.
- Bottom nav: 5 items, icons 21px + 10.5px labels; active = `#8878F9`; center is a raised 52px purple circle "+" (Post a job) with `0 8px 24px rgba(110,86,247,0.4)` shadow, offset −22px above the bar. Bar: `#0A0B0E` bg, top border.

### 2. Active Booking (live tracking)
- **Map hero**: top 264px, same map treatment as home preview; dashed purple route (4px dots), provider pin pulsing purple, destination pin white w/ purple ring; floating back button (38px circle, `rgba(10,11,14,0.78)`) top-left and a "Live" pill (pulse dot + "Live" 13px/600) top-right.
- **Status card** overlapping the map by −32px: radius 22, `#0F1115`, border, shadow `0 12px 40px rgba(0,0,0,0.5)`. Contains:
  - Eyebrow "ON THE WAY" (11px 700, ls 1.6px, `#8878F9`) over "Arriving in 12 min" (27px SG 700).
  - 52px initials avatar circle (`#2A2247`/`#8878F9`) right.
  - Provider row: "Marcus Tremblay" 15px/600, "Bow River Cleaning · ★ 4.9" 13px `#8B92A0`; call button (42px, radius 12, `#161A21` + border) and message button (42px, radius 12, solid `#6E56F7`).
  - Segmented progress: 4 bars, 5px tall, pill radius; done/current = `#6E56F7`, rest `#1F232B`; labels row beneath (11px): "Confirmed 9:14" `#8B92A0` / "On the way" `#8878F9` 600 / "In progress", "Done" `#565D6B`.
- Details card: radius 20, rows separated by 1px `#1F232B`: Service → "Deep cleaning · 3 hr"; Where → "123 Memorial Dr NW"; Total → "$180 · held in escrow" (700, `#2EBD85`). Labels 13.5px `#8B92A0`, values 13.5px/600.
- Secondary button "Message Marcus" (50px, radius 12, `#161A21` + border, message icon).
- Escrow caption centered at bottom with lock icon (12.5px `#8B92A0`).

### 3. Business Dashboard
- Header: "Good morning" (13px `#8B92A0`) over "Bow River Cleaning" (22px SG 700); 40px "BR" avatar circle (`#2A2247`/`#8878F9`) right. Faint purple radial glow top-right of screen.
- **Earnings hero card**: radius 22, gradient `135deg, #2A2247 → #1A1533 60% → #141127`, 1px border `rgba(136,120,249,0.25)`, inner radial glow top-right. Eyebrow "THIS WEEK" (11px 600, ls 1.4px, `#B0A4FB`); "$2,340" (40px SG 700, ls −1.5px) + trending-up icon "18% vs last week" (13px 600 `#2EBD85`); sparkline: 2.5px `#8878F9` curve with vertical fade fill (`rgba(136,120,249,0.28)→0`), ~44px tall.
- KPI row: two cards (radius 18, surface + border): TODAY "4 bookings", RATING "4.9 · 212 reviews" — value 22px SG 700, unit 12px `#8B92A0`.
- "New opportunities" header (17px SG 700) + solid purple count badge "3"; "See all" link.
- **Opportunity card**: radius 20, `#0F1115`, **border `#2A2247`** (purple-tinted to mark new): title "Deep clean — 3BR house" 15.5px/600, meta "Hillhurst · 2.1 km · 12 min ago" 13px `#8B92A0`, price "$150–200" 16px SG 700 `#2EBD85` top-right. Button row: **"Send quote" (flex:1, 44px, radius 12, solid `#6E56F7`)** + **"Pass" (88px, 44px, radius 12, `#161A21` bg, `#1F232B` border, `#8B92A0` text)** ← this square Pass button is a deliberate pick; do not make it a pill.
- Compact second opportunity row (radius 18 card) with "Quote →" link.
- Bottom nav (business): Dashboard (active, grid icon) / Jobs / Earnings / Team / Profile — same bar spec as client.

## Interactions & Behavior
- Entry animations: keep existing spring pattern (`motion.spring` stiffness 220 damping 22, staggered ~60–80ms per card) — already in `ActiveBookingScreen` `SpringCard` and `DashboardScreen` `KpiCard`.
- Pulse animation on live dots: 1.8s loop, ring expanding from 0 → ~9px, opacity fading (see `swPulse` keyframe in the HTML).
- Map preview → `NearbyMapScreen`; featured/nearby card → `BusinessProfile`; opportunity "Send quote" → existing `SendQuoteSheet`; "Pass" dismisses the card (existing behavior).
- Pull-to-refresh, skeletons, empty and error states: keep existing logic; restyle skeleton blocks to match new card dimensions.

## State Management
No new state. This is a visual/structural repolish over the existing screens' data flow (`api.get('/businesses/nearby')`, `api.get('/bookings/:id')`, dashboard KPI derivations stay as-is). The map preview card can be a static styled placeholder until wired to the real map.

## Design Tokens (extends `mobile/src/theme/tokens.js`)
Existing tokens are correct and stay: bg `#07080A`, surface `#0F1115`, surfaceAlt `#161A21`, border `#1F232B`, textPrimary `#F4F6FA`, textSecondary `#8B92A0`, accent `#6E56F7`, accentMuted `#2A2247`, accentText `#8878F9`, success `#2EBD85`, warning `#F6B23B`, danger `#FF5C5C`.

Add:
- `textTertiary: '#565D6B'` (inactive nav labels, future-step timeline labels)
- `accentSoft: '#B0A4FB'` (eyebrow text on purple-tinted surfaces)
- `borderAccent: 'rgba(136,120,249,0.25)'` (new/highlighted card borders)
- `mapBg` gradient stops: `#0D1017 / #101623 / #0E1320`
- shadow `accentGlow: 0 8px 24px rgba(110,86,247,0.4)` (floating CTA)
- Radii/spacing/typography scales unchanged (`design/tokens.md` remains source of truth).

## Assets
No image assets. All icons are Feather (already available via `@expo/vector-icons`). Wordmark is styled text. Sparkline is an SVG path (use `react-native-svg`).

## Files
- `SwingBy Polish.dc.html` — the design canvas. **Section 2a (top) is the spec**; 1a/1b/1c are explorations.
- `ios-frame.jsx`, `support.js` — HTML preview runtime only.

## Suggested overnight prompt for Claude Code
> Read `design_handoff_swingby_polish/README.md`. Implement direction 2a across `mobile/src/`, starting with `screens/client/HomeScreen.js`, `screens/client/ActiveBookingScreen.js`, `screens/business/DashboardScreen.js` and the components they use (`Chip`, `FeaturedCard`, `NearbyCard`, `Button`, `BottomNav`, `CategoryScroll`, `StatusPill`, `BookingStatusTimeline`, `JobOpportunityCard`). Then sweep every remaining screen for the global rules: remove all emoji iconography in favor of Feather icons, enforce purple discipline, square 12px buttons, uppercase section labels, green money values, and pulse animations on live states. Update `theme/tokens.js` with the new tokens. Keep all data fetching, navigation and state exactly as-is. Run lint after each screen.
