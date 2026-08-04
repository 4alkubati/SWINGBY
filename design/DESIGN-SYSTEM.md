# SwingBy design system — canonical entry point

**Direction: 2a "Jet × Pulse".** Everything visual in the mobile app is built from this.
Installed 2026-07-24 from Kira's handoff. This file is the index; the system lives in
`handoff-jet-pulse/`.

## Read in this order (all binding)
| # | File | What it is |
|---|---|---|
| 1 | `handoff-jet-pulse/CLAUDE.md` | Build rules + order of work + hard guardrails. Read first. |
| 2 | `handoff-jet-pulse/README.md` | Direction, design tokens, full specs for the 3 anchor screens (Client Home, Active Booking, Business Dashboard). |
| 3 | `handoff-jet-pulse/POLISH-TIPS.md` | Craft rules + the §10 per-screen self-review checklist. |
| 4 | `handoff-jet-pulse/SCREEN-INDEX.md` | Every screen → source file → required contents → done criteria. |

## Feature handoffs — read the one you're building
| File | Covers |
|---|---|
| `handoff-jet-pulse/MESSAGES-AND-QUOTES.md` | Inbox = booked work only, the docked Quotes bubble, quote card + resolve states. |
| `handoff-jet-pulse/PAYMENTS.md` | The one shared `PaySheet` for both paths, escrow, refunds, disputes. **No dollar figure may appear before the sheet.** |
| `handoff-jet-pulse/PROOF-REQUEST-WEB-AUTOBID.md` | Proof of work (before/after + 60s voice memo), client approve-&-release, Request-sent screen, `web/confirmed.html`, auto-bidding rules + dry run. |
| `handoff-jet-pulse/QUOTE-IN-CHAT.md` | ⚠ **SUPERSEDED — do not build.** Kept for card styling only. |

## Pixel references (open in a browser, do NOT copy the HTML)
- `handoff-jet-pulse/SwingBy All Screens.dc.html` — every screen; find each by its bold **Screen label**.
- `handoff-jet-pulse/SwingBy Polish.dc.html` — the original canvas. **Section 2a (top) is the spec**; 1a/1b/1c are earlier explorations, reference only.

## Non-negotiables (short version)
- Feather icons only, **zero emoji** anywhere.
- Purple `#6E56F7` only for: one primary CTA per screen, active nav, live/pulse dots, selected states.
- Money is green `#2EBD85`. Headings/numerals Space Grotesk 700, body Inter.
- Buttons square-ish (12px radius), 44–52px tall — **never pills**.
- Cards `#0F1115` + 1px `#1F232B` + 20px radius.
- Empty, loading and error states get restyled too, not just the happy path.
- **A control sitting directly on `bg` must have a boundary that clears 3:1** (WCAG 1.4.11) — use `colors.borderStrong` (`#565D6B`). Card fills do **not** qualify: measured on `bg` (`#07080a`), `surface` is 1.06:1, `surfaceAlt` 1.15:1, `border` 1.27:1. See the segmented-control rule below.

## Segmented controls / tabs (added 2026-08-02)

`mobile/src/components/Tabs.js` is the only tab implementation. Do not hand-roll another.

- **Track:** `surfaceAlt` fill + **1px `borderStrong`** outline + `radius.input`. The outline is what makes it discoverable and is not optional.
- **Selected pill:** `accentBtn` (**not** `accent` — `accent` puts a `textPrimary` label at 4.48:1, just under AA).
- **Labels:** selected `textPrimary`, unselected `textSecondary`. Both stay legible; the pill carries the selection, not a disappearing label.
- **Always render a pill**, including the first frame before `onLayout` has measured. A zero-width indicator reads as "no selection".
- **Name the tab after what it shows**, and never reuse a word already on screen as a status chip.

> **Why this is a rule.** Shipped `Tabs` drew its track in `surface` — **1.06:1** against the page. The Details/Progress switch on the business job screen was invisible; the owner found it only by accidentally tapping it and called it "an easter egg". Same component also backs the **signup role picker** (Find Services / Offer Services), so the same invisibility sat on the onboarding fork.

## Also in this folder
- `tokens.md` — token scale source of truth (radii/spacing/type).
- `MOTION.md` — motion rules. Honour these; the current details→budget step transition violates them.
- `components.html`, `home-screen-ali.html` — earlier component/screen studies.
- `handoff-mocks-2026-07-17/` — the 30-screen mock pack (superseded for style by Jet × Pulse; still useful for structure).

## Superseded / do not build
Section **4a** of the canvas (quote bubble *inside* the thread) was explored and rejected —
the bubble docks in the message **list**, per `MESSAGES-AND-QUOTES.md`. `QUOTE-IN-CHAT.md`
is superseded for the same reason.

## Product rules that constrain the UI (Kira, 2026-07-24)
- **The job's budget is never shown to a business.** Businesses bid their own rate; the client compares.
- **The client alone picks the winner.** No ranking or matching that decides for them.
- **Auto-bidding is a paid feature — subscribers only.** Non-subscribers see the screen locked behind an upgrade state.
- **Nothing identifying about a client** — name, avatar, exact address, job photos — reaches a business before that client accepts.
