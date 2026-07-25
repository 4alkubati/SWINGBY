# Proof of work · Request sent · Email confirmed · Auto-bidding — handoff

Four pieces that had no design. Reference frames: section **6a "Four missing pieces"** in `SwingBy All Screens.dc.html`. Tokens in `README.md`, craft rules in `POLISH-TIPS.md`. Payment/escrow behaviour in `PAYMENTS.md`, messaging model in `MESSAGES-AND-QUOTES.md`.

Photo areas in the mocks are **placeholder tiles** — real captures fill them at runtime.

---

# 1 · Proof of work (before/after + voice memo)

Closes the escrow loop: the business shows what it did, the client approves, money releases. Two screens.

| Piece | File |
|---|---|
| Business capture | `business/ProofOfWorkScreen.js` (new) |
| Client review & release | `client/ApproveWorkScreen.js` (new) |
| Release action | existing approve/release endpoint used by `BookingDetailsScreen` |

## Business — capture

Header back button + "Finish job". Hero "Show your work" 24px SG700 ls −0.8, sub "Ali approves from these, and payment releases. Two photos minimum." 13.5px/21px `#8B92A0`.

**Two photo sections, BEFORE and AFTER.** Section label 11px/600/1.4px `#8B92A0` with a right-aligned count: `#2EBD85` when satisfied ("2 added"), `#F6B23B` when not ("1 more needed"). Row of three equal tiles, 104px tall, radius 14, gap 9:
- Filled: `#161A21` + 1px `#1F232B`, thumbnail fills the tile.
- Add tile: `#0F1115` + **1px dashed `#2A2247`**, centered plus icon + "Add" 11px/600 `#8878F9`.
- Trailing empty slot is an invisible spacer (`flex:1`) so tiles keep their width — never stretch two tiles across three columns.

**Voice note, optional.** Label "VOICE NOTE · OPTIONAL". Card `#0F1115` + border, radius 16, padding 14: 44px record button — `#FF5C5C` fill with a 14px white rounded square while recording, `#6E56F7` with a play triangle when there's a recording. Middle: 26px-tall waveform of equal-flex bars (2.5px gap, radius 999): played/recorded bars `#8878F9`, remaining `#2A2247`. Under it: state 11.5px/600 (`#FF5C5C` "Recording…") and `0:18 / 1:00` 11.5px `#8B92A0`, **tabular numerals**. Hard cap 60s. Re-record replaces; only one memo per job.

**Sticky footer CTA** "Send for approval", 52px radius 12. Disabled until 2 before + 2 after photos exist: keep the label `#8B92A0` and apply **a single `opacity: 0.4` to the button** — never also recolor the text (POLISH-TIPS §6).

Upload: queue photos as they're picked, show per-tile progress, retry on failure. Never block the CTA on the voice memo.

## Client — review & release

Header back + "Approve work". Hero "Bow River sent proof" 24px SG700, sub "Deep clean + garage · finished 2:40 PM".

**Side-by-side compare.** Two columns, gap 9. Column label 11px/600/1.4px: BEFORE `#8B92A0`, AFTER `#2EBD85`. Tiles 150px tall, radius 14, `#161A21`; the AFTER tile gets border `rgba(46,189,133,0.3)`, BEFORE plain `#1F232B`. Counter chip bottom-left of each: "1 / 2", 10.5px/600 `#8B92A0` on `rgba(10,11,14,0.78)`, radius 6. Each side swipes independently through its own set; centered hint below, 11.5px `#565D6B` with chevrons: "Swipe either side to compare". Tap a tile for full-screen.

**Voice note player** — same card as capture, 44px purple play button, waveform in `#2A2247` filling to `#8878F9` as it plays, label "Voice note from Marcus" + duration.

**Release notice** — `#161A21` radius 16: green lock icon + "Approving releases **$195** to Bow River." (amount Space Grotesk 700 `#2EBD85`).

**Footer:** primary "Approve & release payment" (52px, solid accent) and a plain-text secondary "Something's wrong" (46px, transparent, `#8B92A0` 600) → `flows/DisputeFlowScreen.js`. Approving is irreversible — confirm with a native alert naming the amount. Funds stay held if they raise an issue instead.

---

# 2 · Request sent — confirmation

Shown after a client sends a booking request from a business profile (Path B in `PAYMENTS.md`). File: `client/RequestSentScreen.js` (new). Replaces the stack — no back to the request form.

- Purple radial glow behind the header (README §10a), pointer-events none.
- 68px `#2A2247` circle with Feather `send` 28px `#8878F9`. Not a check — nothing is confirmed yet, only sent.
- "Request sent" 26px SG700 ls −0.9. Sub 14px/22px `#8B92A0`, max 290px: "Bow River Cleaning usually replies in about 20 minutes." Use the business's real median reply time; fall back to "usually replies within a few hours".
- **Three numbered steps** in a `#0F1115` radius-20 card, gap 14. Step 1 active: 26px `#2A2247` circle, number Space Grotesk 700 11.5px `#8878F9`, title 13.5px/600 `#F4F6FA`, body 12.5px/19px `#8B92A0` — "They send a quote / It lands behind the Quotes bubble in Messages." Steps 2–3 inactive: circle `#161A21` + border, number `#8B92A0`, title `#8B92A0`, body `#565D6B` — "You chat and agree", "Accept & pay / Only then is it booked."
- **No-payment reassurance** — `#161A21` radius 16: lock icon + "**No payment yet.** Nothing is charged until you accept."
- CTAs: primary "Open the conversation" (52px) → the new thread; secondary "Request from more pros" (48px, `#161A21`/border/`#8B92A0`) → back to search with the same job prefilled.

---

# 3 · Email confirmed — web page

File: `web/confirmed.html`. Standalone, no app shell, no nav. Dark `#07080A`, same tokens and fonts as the app. Must work with JS disabled and render on mobile widths.

- Purple radial glow behind the top (620×340, `rgba(110,86,247,0.22)`).
- "Swing**By**" wordmark 20px SG700, "By" in `#8878F9`.
- 76px `rgba(46,189,133,0.14)` circle, green check 34px.
- "Email confirmed" **40px** SG700 ls −1.5, centered. Sub 16px/26px `#8B92A0`, max 430px: "You're all set, {firstName}. Head back to the app to finish setting up and post your first job."
- Two buttons, gap 12, 52px, radius 12: "Open SwingBy" solid `#6E56F7` (deep link, falls back to the store) and "Browse pros on the web" secondary.
- **Fallback card** — max 560px, `#0F1115` + border, radius 18: 40px `#2A2247` tile with a phone icon · "Didn't open automatically?" 14.5px/600 over "Get the app on iOS or Android — your account is already confirmed." 13px `#8B92A0` · "Get the app" link `#8878F9`.
- Footer 12px `#565D6B`: "Wasn't you? **Secure this account** · SwingBy, Calgary AB".
- Error variants on the same layout: **link expired** (amber clock icon, "This link expired", CTA "Send a new link") and **already confirmed** (green check, "Already confirmed", CTA "Open SwingBy").
- Responsive: below 640px the two CTAs stack full-width, hero drops to 30px, page padding 24px.

---

# 4 · Automated bidding — business setup

File: `business/AutoBiddingScreen.js` (new), entered from Dashboard or Settings. Sends real quotes on the business's behalf.

## Rules screen

**On/Off hero** — gradient card `135deg, #2A2247 → #1A1533 60% → #141127`, border `rgba(136,120,249,0.25)`, radius 20, padding 17: eyebrow "AUTO-BID" 10.5px/600/1.2px `#B0A4FB`, state "On" 19px SG700, sub "Quotes send themselves in ~30 s" 12.5px `#B0A4FB`, and a 52×31 switch (`#6E56F7` on, `#1F232B` off) right.

**BID ON** — service chips, radius 12, padding `9 13`, 13px/600. Selected `#2A2247` + `#F4F6FA`; unselected `#0F1115` + 1px `#1F232B` + `#8B92A0`. Multi-select, flex-wrap, gap 8.

**LIMITS** — one `#0F1115` radius-20 card, rows split by 1px `#1F232B`:
| Row | Control |
|---|---|
| Within | Slider, value "12 km" Space Grotesk 700 15px above a 4px track (`#1F232B`, fill `#6E56F7`, 16px white knob) |
| My rate | Value `$55 / hr` green + caption "Applied to the job's scope" |
| Never bid below | Value `$120` green — hard floor |
| Max bids per day | Value `8` |
| Only when a crew is free | Switch, caption "Checks the team calendar" |

Footer CTA "Save rules" (52px). Turning the switch on for the first time opens the dry run rather than going live immediately.

## Dry-run sheet (`AutoBidPreviewSheet`)

Same sheet chrome as the pay sheet (radius `24 24 0 0`, grab handle, dim `rgba(4,5,7,0.68)`).

- Title "Last week, these rules" 21px SG700; sub "Nothing was sent — this is a dry run." 13px `#8B92A0`.
- Two stat cards `#161A21` radius 16: "**9** of 14 jobs matched" and "**$1,640** would have been bid" (value 24px SG700 ls −0.7, the money one green).
- Match list `#161A21` radius 16, rows split by `#1F232B`: 28px radius-8 status tile — matched `rgba(46,189,133,0.14)` + green check, skipped `rgba(255,92,92,0.14)` + red x — then "Deep clean · Hillhurst · 2.1 km" 12.5px `#8B92A0`, then the bid amount green SG700 13.5px. Skipped rows go `#565D6B` and **state the reason** ("19 km — too far" / "Skipped").
- Warning caption: "Auto-bids are real quotes. Clients see them exactly like ones you write — you can withdraw within 5 minutes."
- CTA "Turn auto-bidding on" (52px).

## Behaviour
- Bid amount = rate × the job's estimated scope, clamped to the floor. Never bid below the floor even if that loses the job.
- Respect the daily cap and crew availability at send time, not at rule-save time.
- Auto-sent quotes are ordinary quotes: they appear in the business's Sent quotes list (`MESSAGES-AND-QUOTES.md`) tagged "Auto", and to the client indistinguishably from a hand-written one.
- 5-minute withdraw window on auto-sent quotes; after that, normal quote rules.
- If rules match nothing for 7 days, surface a nudge on the Dashboard ("Auto-bid hasn't matched anything — widen your radius?").

---

## Done criteria
Proof capture enforces the 2+2 minimum with the correct single-opacity disabled CTA; voice memo caps at 60s with tabular timer. Client review swipes both sides independently, plays the memo, and names the release amount before approving. Request-sent uses a send icon (not a check) and states no-payment. Web page renders at mobile widths, has expired/already-confirmed variants, and works without JS. Auto-bidding cannot go live without passing through the dry run; the floor is never breached. Empty/loading/error states styled for all four. `POLISH-TIPS.md` §10 checklist + lint.
