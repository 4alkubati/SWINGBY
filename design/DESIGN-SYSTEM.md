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
