# BRIEF — Business-Side Flow: My Business tab, Customer Visibility, Pre-Booking Messaging, Income Speed

> **STATUS 2026-07-03: ALL WORKSTREAMS SHIPPED to working tree + Supabase migration applied + API-level smoke test green.** Remaining: on-device Expo Go verify (both seed accounts), commit+push (tree has unrelated human changes), Render redeploy. Details in `claude/memory/SESSION_LOG.md`.
> Created 2026-07-03 from user interview. Owner: Orchestrator.
> Theme: **the business side must never look like it's blocking the business's way of income.**
> User-confirmed decisions: (1) My Business tab currently errors on Expo Go, (2) chat opens after a business expresses interest (quotes) on a post — spam shield stays, (3) invoices = payout history now, client-facing invoicing later phase, (4) all four income-friction areas are in scope + "business can't see the customer" on the dashboard.

---

## Verified root causes (code audit 2026-07-03)

| # | Finding | Evidence |
|---|---|---|
| 1 | **My Business tab errors** — `BusinessProfileScreen` resolves `resolvedId = businessId \|\| user?.business_id`, but `GET /auth/me` (`backend/app/api/auth.py:411`) returns only `{id, first_name, last_name, email, phone, role, avatar_url, created_at}` — **no `business_id`** → `resolvedId` undefined → "Could not load profile" | `mobile/src/screens/business/BusinessProfileScreen.js:222-229` |
| 2 | **Business can't see the customer** — backend service-posts feed already returns `users(first_name, last_name)` (`service_posts.py:131`), but `JobOpportunityCard.js` never renders the client name/avatar. Booking cards likewise | grep: no `first_name/client` in JobOpportunityCard |
| 3 | **Weekly earnings always $0** — `DashboardScreen.js:161` sums `b.total_price`; bookings field is `total_amount` (`bookings.py:522`) | field-name mismatch |
| 4 | **No pre-booking chat** — messages hard-locked to bookings (`messages.py` `MessageSend.booking_id` required, `_assert_message_access` checks booking parties). MessagesScreen lists only confirmed+ bookings | design decision being amended |
| 5 | **Invoices unreachable for business** — `InvoiceScreen` registered in BusinessNavigator stack, backend `GET /bookings/{id}/invoice(.pdf)` exists (D2.2), but no business-side entry point and no list view | BusinessNavigator.js:116, invoices.py |
| 6 | **Dashboard `deltaPct={18}` hardcoded**; earnings hero not from payments table | DashboardScreen.js:272 |
| 7 | Back-arrow on My Business tab calls `goBack()` at tab root — dead end | BusinessProfileScreen.js:351 |

---

## WS-A — Fix "My Business" tab (P0 — the reported bug)

**5W+H:** WHO business owners on Expo Go · WHAT tab loads reliably and exposes Settings / Invoices / everything · WHEN first · WHERE BusinessProfileScreen + auth.py · WHY owner literally cannot see their own business today · HOW two-sided fix.

- Backend: `GET /auth/me` — for `business_owner`, join `businesses` by `owner_id` and include `business_id` in the payload.
- Mobile: `BusinessProfileScreen` — when no `businessId` param and no `user.business_id`, fall back to `api.get('/businesses/me')` (belt-and-braces; works even with a stale cached token/user).
- Hide the back arrow when the screen is the tab root (no `navigation.canGoBack()` → no arrow).
- Add **Invoices** row to the Account menu → new `BusinessInvoicesScreen` (WS-E).

**DONE-RULE:** Fresh Expo Go session as testbusiness@swingby.dev → My Business tab renders profile, Team, Plan, Account menu incl. Invoices; Settings opens; zero error screens.

---

## WS-B — Customer visibility (P0 — "business can't see the customer")

**5W+H:** WHO businesses scanning leads · WHAT every lead/job/booking shows the human behind it · WHY trust + faster quoting decisions; anonymous cards feel like the platform is hiding the customer · WHERE JobOpportunityCard, MyJobsScreen (business lens), BookingDetails, Dashboard.

- `JobOpportunityCard`: render client first name + initials avatar (data already in the feed payload — zero backend work), plus posted-time and address/distance if present.
- Business job feed rows + booking cards: client name + avatar consistently.
- `BookingDetailsScreen` (business view): prominent client block — name, avatar, job address, tap-to-message (WS-C thread).
- Backend: ensure `GET /bookings/` for business embeds client `users(first_name, last_name, avatar_url)` (add join if missing).
- Privacy line: first name + avatar only pre-booking; full contact stays inside the app (no phone/email leak — keeps everything on-platform).

**DONE-RULE:** Dashboard opportunity card shows "Sarah M. · Sunnyside · 2h ago"-style identity; booking details show the client block with a working Message button.

---

## WS-C — Pre-booking messaging: quote-triggered chat (P1 — the flow change)

**Decision (user-approved):** business quotes on a post → a chat thread opens between that business and the post's client immediately — negotiation, questions, "can you do Tuesday instead?" — *before* acceptance. If the client rejects, the thread stays open (counter-offer chance) until the post closes/expires. **No interest = no chat** — spam shield stands.

**DB migration (Supabase):**
- `messages.interest_id uuid NULL REFERENCES interests(id)`; `booking_id` → nullable; `CHECK (booking_id IS NOT NULL OR interest_id IS NOT NULL)`.
- RLS: participants of the interest (post's client, interest's business owner + active employees) read/insert, mirroring booking policy.

**Backend (`messages.py`):**
- `MessageSend` accepts `booking_id` OR `interest_id`.
- `_assert_interest_access` helper (client of post / owner of business on interest).
- `GET /messages/interest/{interest_id}`.
- **New `GET /messages/threads`** — unified inbox: one row per booking-thread AND per interest-thread → `{thread_type, id, counterpart{name, avatar}, post_title/booking ref, last_message, last_at, unread_count}`. Kills MessagesScreen's N+1 (currently fetches bookings then messages per row).
- Push (`send_push_to_user`) + existing notification row on every message, deep-link payload `{thread_type, id}`.
- On interest **accept** → booking created: carry the conversation over (either stamp those messages with the new `booking_id`, or have `/messages/threads` merge interest-thread into the booking-thread — pick simplest during build).

**Mobile:**
- `MessagesScreen` → single `GET /messages/threads`; interest threads badged "Quote" vs booking threads "Booking"; unread counts; unread badge on Messages tab icon.
- `ChatScreen` accepts `{interestId}` or `{bookingId}`; header shows post title + counterpart.
- Entry points: SendQuoteSheet success → "Message {client}" action; JobManagement/interest rows → Message; client side: received-quote card → Message business.
- Client-side MessagesScreen gets the same unified inbox (it's the same screen component — both navigators reuse it).

**Anti-spam guardrails:** thread creation only via a real interest row; one thread per (post, business); optional post-MVP: client block/report.

**DONE-RULE:** Business quotes on a test post → thread appears in both inboxes → messages flow both ways with push → client rejects → business sends a counter in the same thread → client accepts a re-quote → booking created and the conversation continues under the booking. Verified on two Expo Go devices/accounts.

---

## WS-D — Faster quoting (P1 — income speed)

**WHY:** every extra tap between "saw the lead" and "quote sent" is lost income.

- `SendQuoteSheet`: price + optional opening message in one sheet → sending the quote ALSO sends the first chat message (seeds the WS-C thread). Two taps from dashboard to quoted-and-messaged.
- Pre-fill last quoted price for the same category.
- Business "Jobs" view (MyJobsScreen business lens): show **my quote status per post** (pending / rejected / accepted) so businesses instantly see what needs follow-up; rejected rows expose "Message client" (counter-offer path).
- Quote-related pushes deep-link straight into the thread/post.

**DONE-RULE:** From dashboard card → quote sent with message in ≤ 2 taps + typing; Jobs list shows quote status chips.

---

## WS-E — Money visibility: invoices + real earnings (P1)

**Phase 1 (this brief) — payout/receipt history:**
- New `BusinessInvoicesScreen` — completed/paid bookings list: client, date, `total_amount`, platform cut, escrow state (from payments row), tap → existing `InvoiceScreen` (`GET /bookings/{id}/invoice`), PDF share via existing `.pdf` endpoint.
- Backend: `GET /businesses/me/invoices` (or reuse `GET /bookings/?status=completed` + payments join) — one call, no N+1.
- Fix Dashboard: `total_price` → `total_amount`; earnings hero from real payments (escrow_held vs released); compute real `deltaPct` (this week vs last) or hide the badge — no fake numbers.
- `EarningsScreen`: escrow breakdown — held / released / lifetime, per-booking rows.

**Phase 2 (separate brief, NOT now):** business-generated invoices that clients pay in-app (Stripe invoice or checkout-session flow).

**DONE-RULE:** My Business → Invoices lists real completed bookings with correct amounts; Dashboard weekly earnings shows a non-zero real sum for the seeded test data; no hardcoded delta.

---

## WS-F — Dashboard: action-first, fast (P2 polish)

**WHY:** dashboard is the business's morning screen — it must answer "what makes me money right now?" in one glance, and load instantly.

- **Needs-attention strip** at top: `N new leads · N unread messages · N jobs awaiting action` — each chip deep-links (leads → Jobs, unread → Messages thread list, awaiting → JobManagement).
- Data: single parallel load (already Promise.all) + add `/messages/threads` unread sum; consider a light `GET /businesses/me/dashboard` aggregate later if payload count grows.
- Perf pass: cache last dashboard payload (render stale-while-refetching so the screen paints instantly on reopen); skeletons already exist.
- Keep: Earnings hero, KPI row, opportunities (now with client identity from WS-B), tools row.

**DONE-RULE:** Cold open of Dashboard paints < 1s on LAN with cached data; needs-attention chips navigate correctly; nothing on the screen is fake data.

---

## Build order & gating

| Order | WS | Bucket | Blocked by |
|---|---|---|---|
| 1 | WS-A My Business fix | A — just do it | — |
| 2 | WS-B Customer visibility | A | — |
| 3 | WS-E dashboard money fixes (`total_amount`, delta) | A | — |
| 4 | WS-C messaging (migration → backend → mobile) | A code + migration | Supabase migration applied |
| 5 | WS-D fast quoting | A | WS-C (thread seed) |
| 6 | WS-E invoices list screen | A | — |
| 7 | WS-F dashboard action strip + perf | A | WS-C (`/messages/threads`) |

**Verification:** every WS ends with an on-device Expo Go check using testbusiness@swingby.dev + testclient@swingby.dev; WS-C needs both accounts live. Regenerate flow graph (`tools/flow_graph.py`) after nav changes.

**Out of scope (parked):** client-facing invoicing (Phase 2), block/report in chat, push-notification production wiring (Phase 5), employee chat access polish.
