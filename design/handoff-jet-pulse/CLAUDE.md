# START HERE — SwingBy app design handoff

> Rename this file to `CLAUDE.md` at your repo root if you want Claude Code to pick it up automatically.

You are implementing a visual repolish of the SwingBy React Native / Expo app. This folder is the design handoff. **Read these three files before writing any code, in order:**

1. `README.md` — the 2a "Jet × Pulse" direction, design tokens, and detailed specs for the 3 anchor screens.
2. `POLISH-TIPS.md` — craft-level rules (typography tracking, purple-scarcity, surfaces, spacing, states) + a per-screen self-review checklist. **Binding.**
3. `SCREEN-INDEX.md` — every screen mapped to its source file, with what each must contain and the done-criteria.

### Feature handoffs (read the one you're building)
| File | Covers |
|---|---|
| `MESSAGES-AND-QUOTES.md` | Inbox model (chats = booked only), the Quotes bubble, quote card + resolve states |
| `PAYMENTS.md` | The shared pay sheet, both payment paths, escrow / refunds / disputes |
| `PROOF-REQUEST-WEB-AUTOBID.md` | Proof of work, request-sent confirmation, email-confirmed web page, auto-bidding |
| `QUOTE-IN-CHAT.md` | ⚠ **SUPERSEDED** — do not build; kept for the card styling only |


The pixel reference is `SwingBy All Screens.dc.html` — open it in a browser and find each screen by its bold **Screen label**. It is a *design reference in HTML*; do NOT copy the HTML. Recreate each screen in the existing RN codebase using its components, theme, and patterns.

## Order of work
1. **Tokens first** — add the new tokens (README §Design Tokens) to `theme/tokens.js`. Nothing else references hardcoded hexes.
2. **Shared components** — restyle the component sweep list in `SCREEN-INDEX.md` (`Button`, `BottomNav`, cards, pills, etc.). Most screens inherit correctness from these.
3. **Anchor screens** — Home, Active Booking, Business Dashboard (fully specced in README).
4. **Sweep every remaining screen** in `SCREEN-INDEX.md`, client then business, applying the global rules.

## Hard guardrails (do not violate)
- No new dependencies, no new state, no changed data-fetching or navigation. This is visual/structural only.
- Icons: Feather via `@expo/vector-icons` only. **Zero emoji anywhere**, including empty states and toasts.
- Purple `#6E56F7` only for: primary CTA (one per screen), active nav, live/pulse dots, selected states.
- Money values green `#2EBD85`. Headings & numerals Space Grotesk 700; body Inter.
- Buttons square-ish (12px radius) — never pills. Cards `#0F1115` + 1px `#1F232B` + 20px radius.
- Restyle **empty / loading / error** states too, not just the happy path.

## Per-screen loop
For each screen: read its source → recreate against its mock frame → style all states → run the `POLISH-TIPS.md` §10 checklist → `lint` → next. Commit one screen (or one shared component) per commit with a clear message.

## Repo assumptions to verify
Paths in `SCREEN-INDEX.md` assume `mobile/src/screens/…` and `mobile/src/components/`. Confirm the real layout first (`ls mobile/src`) and adjust prefixes if they differ — the file *basenames* (e.g. `HomeScreen.js`) are the reliable part. One flag: `My Business (owner view)` and `Business Profile (public)` both point at `BusinessProfileScreen.js`; confirm whether owner view is a mode/prop of that screen or a separate file, and follow the codebase's actual split.
