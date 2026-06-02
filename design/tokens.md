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
| accent | #6E56F7 | Primary accent, CTAs, active states |
| accentMuted | #2A2247 | Tinted accent backgrounds |
| success | #2EBD85 | Verified, completed, positive |
| warning | #F6B23B | Caution, pending |
| danger | #FF5C5C | Error, destructive, cancel |

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

## Design References

| Reference | What we borrow |
|---|---|
| Linear | Clarity, minimal chrome, dense information |
| Stripe | Typography hierarchy, generous whitespace |
| Robinhood | Card layouts, financial data presentation |
| Vercel | Whitespace, dark theme execution |
| Apple HIG | Motion grammar, spring physics |
