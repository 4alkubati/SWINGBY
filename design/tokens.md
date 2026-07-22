---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build]
---
# SwingBy Design Tokens — UX Pass

> Single source of truth for all visual constants.
> Mobile: `mobile/src/theme/tokens.js` + `typography.js`
> Web pre-launch: `web/pre-launch/src/theme/tokens.css`
> Web admin: `web/admin/src/theme/tokens.css`

---

## Colors

| Token | Hex | Usage |
|---|---|---|
| bg | #07080a | Main screen background |
| surface | #0F1115 | Cards, inputs, nav |
| surfaceAlt | #161A21 | Elevated surfaces, tags |
| border | #1F232B | Borders, dividers |
| textPrimary | #F4F6FA | Headings, names, key info |
| textSecondary | #8B92A0 | Labels, meta, hints |
| textTertiary | #565D6B | Inactive nav labels, future-step timeline labels |
| accent | #6E56F7 | Primary accent, CTAs, active states, live/pulse indicators |
| accentMuted | #2A2247 | Tinted accent backgrounds |
| accentText | #8878F9 | Purple text/links on dark (AA 6.10:1 on bg) |
| accentBtn | #6D55F6 | Button backgrounds with textPrimary label (AA 4.56:1) |
| accentSoft | #B0A4FB | Eyebrow text on purple-tinted surfaces (earnings hero) |
| borderAccent | rgba(136,120,249,0.25) | New / highlighted card borders |
| success | #2EBD85 | Verified, completed, positive, **all money values** |
| warning | #F6B23B | Caution, pending |
| danger | #FF5C5C | Error, destructive, cancel |
| mapBgTop | #0D1017 | Map preview gradient, top stop |
| mapBgMid | #101623 | Map preview gradient, middle stop |
| mapBgBottom | #0E1320 | Map preview gradient, bottom stop |
| overlayScrim | rgba(10,11,14,0.78) | Glass-lite overlay pills/bars on map |

---

## Spacing Scale

| Token | Value | Usage |
|---|---|---|
| xs | 4px | Tight inner padding |
| sm | 8px | Chip padding, icon gaps |
| md | 12px | Input padding, small gaps |
| base | 16px | Default padding, section gaps |
| lg | 24px | Card padding, section spacing |
| xl | 32px | Large section spacing |
| 2xl | 48px | Hero spacing |
| 3xl | 64px | Page-level spacing |

---

## Border Radius

| Token | Value | Usage |
|---|---|---|
| chip | 8px | Chips, small badges |
| input | 12px | Text fields, inputs |
| button | 12px | Buttons |
| card | 20px | Cards, containers |
| sheet | 28px | Bottom sheets, modals |
| pill | 999px | Pills, status indicators |
| avatar | 999px | Circular avatars |

---

## Shadows

| Token | Spec | Usage |
|---|---|---|
| none | — | Flat surfaces |
| subtle | 0 4px 8px rgba(0,0,0,0.16), elevation 4 | Cards, floating elements |
| modal | 0 8px 24px rgba(0,0,0,0.32), elevation 12 | Modals, sheets, overlays |
| accentGlow | 0 8px 24px rgba(110,86,247,0.4), elevation 12 | Floating purple CTA ("Post a job" nav button) |
| card | 0 12px 40px rgba(0,0,0,0.5), elevation 16 | Status card overlapping map hero |

---

## Typography

| Variant | Font | Size/Height | Weight | Usage |
|---|---|---|---|---|
| display1 | Space Grotesk | 40/48 | 700 | Hero headings |
| display2 | Space Grotesk | 28/34 | 700 | Section headings |
| display3 | Space Grotesk | 22/28 | 700 | Card headings |
| h1 | Space Grotesk | 20/26 | 700 | Page titles |
| h2 | Space Grotesk | 18/24 | 400 | Subheadings |
| body | Inter | 16/24 | 400 | Body text |
| bodyMedium | Inter | 16/24 | 600 | Emphasized body |
| small | Inter | 14/20 | 400 | Secondary text |
| smallMedium | Inter | 14/20 | 600 | Labels, nav |
| caption | Inter | 12/16 | 400 | Meta, timestamps |
| label | Inter | 11/14 | 600 | Uppercase labels |

---

## Jet × Pulse Rules (approved direction 2a — `design/handoff-jet-pulse/`)

1. **No emoji as UI iconography** — Feather icons only (`@expo/vector-icons`), stroke ~1.8, sizes 16–22.
2. **Purple discipline** — `accent` only for primary CTAs, active nav, live/pulse indicators, selected states. Everything else neutral. `accentText` for purple text/links on dark.
3. **Money is green** — all earnings/price values use `success`.
4. **Headings** — Space Grotesk 700, tight letter-spacing (−1 to −1.5px at 27–40px). Screen heroes are BIG.
5. **Cards** — `surface` bg + 1px `border` + 20px radius; secondary surfaces `surfaceAlt`. No glassmorphism except the two sanctioned glow moments (header radial glow, earnings gradient card).
6. **Buttons are square-ish** — 12px radius, 44–52px tall. Never pill-shaped.
7. **Section headers** — 11px / 600 / letter-spacing 1.4px / UPPERCASE / `textSecondary`; optional "See all" link in `accentText`.
8. **Live states pulse** — see `MOTION.md` § Live Pulse.
9. **Trust copy** — surface escrow on booking screens: "Payment releases only when you approve the work."

Full screen specs: `handoff-jet-pulse/README.md` + `SwingBy Polish.dc.html` (section 2a is the spec; 1a/1b/1c are explorations).

---

## Design References

| Reference | What we borrow |
|---|---|
| Linear | Clarity, minimal chrome, dense information |
| Stripe | Typography hierarchy, generous whitespace |
| Robinhood | Card layouts, financial data presentation |
| Vercel | Whitespace, dark theme execution |
| Apple HIG | Motion grammar, spring physics |

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]

**Related:** [[MOTION]]
<!-- graph-wire:end -->
