# Decision 34 — Design gap triage (GAP-AUDIT #34)

> STRATEGY lane, 2026-07-23. Triages the 63 tagged items from the mock-atlas exec spec
> (`~/brain/10-swingby/agents/claude/deliverables/design-exec-spec-2026-07-18.md`, the
> readable form of `design/handoff-mocks-2026-07-17/`) into a prioritised work queue.
> **Every "status" below was re-checked against the live code at `main` (a083f7b) today** —
> the spec is 5 days old and several items already shipped. "verified in code" vs. "my
> judgement" is marked throughout.

## Headline

The spec counted **2 P0 · 26 P1 · 35 P2 = 63 tagged (61 real work items)**. Re-checking today:
**both P0s already shipped**, and ~8 P1/P2s shipped or were made obsolete by product moves.
The remaining real, actionable, *not-backend-blocked* queue is **~14 items**, of which **9
would be noticed by an investor or user** on Saturday. The rest are polish or blocked on schema
work that shouldn't start this week.

## Group C first — already done or obsolete (do NOT queue)

Clear these off the board so nobody re-does them.

**Already shipped since the spec (verified in code today):**
- **#16 Referral P0** — no longer hardcoded `0/$0`; reads real `GET /me/referrals`
  (`ReferralScreen.js`). *Verified.*
- **#11 EmployeeProfile P0** — the "coming soon" string is gone; renders honest "No reviews
  yet" (`EmployeeProfileScreen.js:331`). *Verified.*
- **#14 ProfileEdit avatar upload** — wired to `/uploads/image`, no longer "coming soon"
  (`ProfileEditScreen.js:93`). *Verified.*
- **#2 ProfileScreen "Invite friends" badge** — `MenuRow` now has a `badge` prop
  (`ProfileScreen.js:27`). *Verified.*
- **#10 BizProfile owner completeness meter** — `computeProfileCompleteness()` shipped. *Verified.*
- **#10 BizProfile public distance stat** — `computeDistanceKm` rendered ("X km"). *Verified.*
- **#7 Search result-count header** — renders `{count} RESULTS NEAR YOU`
  (`SearchScreen.js:298,316`). *Verified.* (The verified/category badge half of #7 is NOT done —
  see Group A.)

**Obsolete — product moved (do NOT build to the mock):**
- **#26 JobManagementScreen** — the spec flagged a mock/target mismatch needing a product call.
  **Resolved by the code**: `JobManagementScreen.js` is now a Today/Upcoming/Needs-action/Past
  tabbed jobs hub (`:562` comment: "Replaces the earlier New/Quoted/Scheduled lead-triage
  tabs"), and lead-triage lives in `DashboardScreen`. The mock's "Job Management" frame is
  stale. *Verified — nothing to build here.*
- **#12 MessageThreadScreen** — consolidated into `ChatScreen` (`MessageThreadScreen.js` is now
  a 14-line re-export). The job-context strip the spec wanted ships as `ChatBookingSummary`
  (category + confirmed date + tap-through). *Verified — the job-context half is done.* Only the
  presence/read-receipt half remains, which is Group B (mocked, low value).
- **"Keep it, exceeds mock" notes** counted in the 63 but never real work: #1 Messages pill,
  #5 BookingDetails, #19 Invoice, #20 Settings, #22 Onboarding carousel, #23 Login. *No action.*

## Group A — an investor or user WOULD notice (ranked by visible impact ÷ cost)

Ranked so someone picks them off the top. All are **client-side-only, real data already
available, zero backend dependency** unless noted — deliberately, so they're shippable before
Saturday. Status of each re-verified in code today (all confirmed **not** shipped).

| Rank | Item | Screen(s) | Why it's visible | Cost | Impact÷cost |
|---|---|---|---|---|---|
| **A1** | **"Verified"/trust badge + "Recommended" copy on the top quote** (#4) | QuoteComparison | This is the *money-decision* screen an investor clicks through; the trust badge is the entire SwingBy pitch. Today it says "Best value" with no badge. `license_status` is already on the fetched interest join — pure UI. | Low | **Highest** |
| **A2** | **Verified badge + category label on business cards** (#7, #9) via `NearbyCard` | Search, Favorites, (Nearby Map) | Browse/search is the first-impression surface for supply. `NearbyCard` has **no** `verified`/`category` prop today (verified: 0 hits) — one shared component fix lights up 3 screens. Data already fetched. | Low (one component) | **Very high** |
| **A3** | **Escrow reassurance line in the dispute flow** (#18) | DisputeFlow step 1 | The escrow "moat" is invisible at the exact anxious moment it should reassure. "Payment can be held in escrow while we investigate. Most disputes resolve within 48h." Pure copy, no backend. Strong investor-narrative line. | Trivial | **Very high** |
| **A4** | **Recent Payouts itemized list** (#27) | Earnings (business) | Mock's whole metaphor is a wallet; current shows only aggregate stat cards. `/payments/mine` is **already fully fetched** — it's being aggregated, not listed. (The "Withdraw to bank" CTA stays out — that's Stripe Connect, Decision 16.) | Low | High |
| **A5** | **Notifications TODAY/EARLIER grouping + review→star icon** (#13) | NotificationsCenter | Flat undated list looks unfinished; grouping is standard and expected. Pure client-side bucket on `createdAt`; add `review→star` to `iconForType` (verified: no `review` case today). | Low | High |
| **A6** | **Today's Assignments + rating/job-count on employee rows** (#30) | EmployeeManagement | Business-ops screen; today's bookings already carry `scheduled_date`+`employee_id`. Real data. (The available/off-shift dot is mocked — Group B.) | Low–Med | Medium-high |
| **A7** | **Invoice filter tabs (All/Paid/Pending) + Outstanding total** (#29) | BusinessInvoices | `invoices` array already fetched; filter + sum is client-side. (Skip the "Overdue" tab — no due-date concept exists; Group D.) | Low–Med | Medium |
| **A8** | **Review quick-tag chips + job-context subtitle** (#6) | ReviewScreen | Chips append to the free-text `comment` (no schema change); subtitle threads `category`/date already on the booking. Nudges review completion = more trust signal. | Low | Medium |
| **A9** | **Location/place + radius pill on the map** (#8) | NearbyMap | Real orientation/trust cue ("Kensington · 2km"). **Higher cost**: needs **reverse geocoding**, which does not exist — `geocoding.py` has forward geocode only (verified: 0 hits for `reverse`). Uses the Google key already in the project (no new spend). | Medium | Medium |

**Not in the Saturday-9:** #24 Signup role-cards visual (real UX change, bigger lift, flag as a
flow decision not a quick pass); #3 TextField character counter (low visible impact for the
build cost of touching a shared component).

## Group B — polish that can wait

- Copy parity: #9 Favorites missing "here.", #25 ForgotPassword "Reset your password" vs
  "Forgot password?", #22 Onboarding line, #16 Referral "GIVE $10 · GET $10" two-sided copy,
  #4 chat-timing disclaimer caption.
- #23 Login wordmark-vs-"S" brand call; social buttons' brand glyphs (blocked on social auth).
- #10 photo-carousel "+9" overlay; #10 Reviews "See all" link (needs a new ReviewsList screen).
- #29 invoice number on each row.
- #12/#30 **presence-mocked** items (online status, read receipts, available/off-shift) — the
  whole `mockPresence.js` service was **never built** (verified: 0 hits for `mockPresence`).
  My judgement: **do not build fake presence for the investor demo.** It adds fabricated
  trust-signal UI to a trust-first product for near-zero investor value. Lower priority than
  every real-data item above.

## Group D — backend/schema-blocked (do NOT start mobile work; not this week)

These are legitimately blocked and were correctly flagged as such in the spec. Listed so nobody
picks one up expecting it to be a quick UI pass:
`interests.message` quote bubble (#4) · response-time metric (#4/#28) · `reviewee_type=employee`
(#11 real fix) · readable referral codes (#16) · business services-with-pricing (#10/#31) ·
working hours (#10/#30) · Stripe Connect payout status + "Withdraw" CTA (#10/#27 — gated on
Decision 16) · overdue-invoice concept (#29 third tab) · employee-invite tracking (#30) ·
analytics period-over-period deltas (#28) · multi-category businesses (#31).

## One-line answer for the phone

Both P0s and ~8 lesser items already shipped or went obsolete; the real queue is 9
investor-visible, backend-free wins led by **the quote-screen trust badge**, **verified/category
badges on business cards** (one shared-component fix, 3 screens), and **the escrow reassurance
line in disputes** — all cheap, all shippable before Saturday; skip fake "presence" UI and
everything schema-blocked.
