# PLAN.md — Active Plan

> Written by Orchestrator. Every task framed through DISPATCH_GATE Layer 1 (5W+H) before it lands here.
> **Mode: AUTONOMOUS + GATED** per `config/LOOP.md`. 3-bucket gate (A: just do it · B: park to HUMAN-TODO · C: hard-stop).

## Project: SwingBy
## Repo: /home/l3thal/agents/projects/swingby

---

## 🌙 Tonight — overnight queue (2026-07-16 → 17) — Phase UBER ✅ COMPLETE (executed overnight 398502, re-verified + closed 2026-07-17) — READY-TO-PUSH

> **STATUS: all 8 tasks done in the working tree, local gates green, NO push (Bucket C = Kira's morning).** Executed overnight (Opus orchestrator 398502): UBER-1 employee upsert ✅ · UBER-2 BookingDetails reachable ✅ · UBER-3 confirm-date handshake card ✅ · UBER-4 date_confirmed event ✅ · UBER-5 browse-first Home ✅ · UBER-6 General catch-all ✅ · UBER-7 docs ✅ · UBER-8 QA regression ✅. Overnight gates: pytest 36/3 · babel 115/0 · flow graph 0 broken. Re-verified 2026-07-17 (flow graph 0 broken re-run · py_compile clean on all 8 changed backend files · i18n 6/6 EN/FR/AR · ConfirmDateCard in 3 hosts · first confirm-date PATCH caller); pytest+babel not re-runnable on this box (no docker/pip/node_modules — audit #9). Detail in STATUS.md + SESSION_LOG. Morning: Kira reviews READY-TO-PUSH → push → Render smoke → Android on-device verify.

> **Source:** full Uber-flow audit `docs/qa-audit-2026-07-16-uber-flow.md` (prod-verified 2026-07-16; extended flow test passes once an employee exists). Kira approved this queue + order in the evening session. Work in order; every task Bucket A unless noted. Never push, never deploy, never send (push is Kira's morning — he now has an Android phone and will on-device test right after pushing). Booking-loop code changes: local gates tonight (pytest + babel + flow graph); `tools/e2e_smoke.py` vs Render is the MORNING gate after Kira pushes (same pattern as Phase CAT).

| # | Task | Route | DONE-RULE |
|---|---|---|---|
| 1 | **UBER-1 backend — fix employee-create 409.** A DB trigger on `auth.users` pre-creates the `public.users` row (role='client', empty names) when `auth.admin.create_user()` runs, so the insert at `employees.py:78` hits 409 and the endpoint 400s — broken in prod for every business. Fix: after create_user, UPDATE the users row (role='employee', first_name, last_name, phone) instead of INSERT (upsert acceptable); keep the employees-table insert. Add a conftest-pattern test covering the trigger-row case. | backend-agent | docker pytest full suite green incl. new test; py_compile clean |
| 2 | **UBER-2 mobile — make BookingDetails reachable.** Today the ONLY entries are notification tap + deep link; Pay-with-card, mark-paid-offplatform, and the client LiveStatusTimeline are all trapped there. Add `navigate('BookingDetails', { bookingId })` from (a) MyJobsScreen booking rows and (b) ActiveBookingScreen (button or header link). Do not remove existing ActiveBooking flows. | mobile-agent | Babel parse 0 errors; grep shows navigate('BookingDetails') in MyJobsScreen + ActiveBookingScreen; `python3 tools/flow_graph.py` regen shows the new edges, 0 broken |
| 3 | **UBER-3 mobile — confirm-date handshake UI (client side).** Kira's design call: it must appear in the MESSAGES thread as a handshake — when a booking has `proposed_date_1..3` and no `confirmed_date`, the client's chat thread (Chat/MessageThread for that booking) shows a pinned proposal card: "Business proposed these times" with 1–3 date chips + Accept button per chip → `PATCH /bookings/{id}/confirm-date {confirmed_date}` → card flips to confirmed state. Also render the same card on BookingDetails. Endpoint verified working on prod (moves booking to in_progress, pushes+emails business). | mobile-agent | Babel 0 errors; PATCH confirm-date call exists in mobile/src (today: zero callers); card renders for bookings with proposed dates and disappears once confirmed_date set |
| 4 | **UBER-4 backend — `date_confirmed` timeline event.** Add `date_confirmed` to `_ALLOWED_EVENT_TYPES` (booking_events.py) and insert the event inside `confirm_date` (bookings.py:259) so the timeline records the handshake (today it never does). ASAP-vs-required enforcement is NOT decided — keep confirmation optional, park the product question to HUMAN-TODO. | backend-agent | pytest green; new test asserts confirm-date inserts a date_confirmed booking_event |
| 5 | **UBER-5 mobile — Home browse-first.** Kira's call: client Home opens straight into browsing; kill the top Browse/Post toggle (`HomeScreen.js:361` renders PostJobScreen inline behind it); Post a job lives at the BOTTOM (bottom-nav/FAB entry — `BottomNav --> PostJob` edge already exists). PostJob must stay reachable + working. | mobile-agent | Babel 0 errors; Home renders browse content with no top toggle; flow graph: PostJob still reachable, 0 broken edges |
| 6 | **UBER-6 — General catch-all category UX.** Kira's call: off-taxonomy services (massage etc.) file under **General** — visible to all businesses, findable via search. Backend: `normalize_category` snaps unknown/unmatched values to `GENERAL` on post create (stop passing unknowns through); keep `?category=` search working for General. Mobile: PostJob picker gets an explicit "Other / General" option. | backend-agent + mobile-agent | pytest: unknown category on create stored as "General"; babel 0 errors; picker shows the option |
| 7 | **UBER-7 docs cleanup.** `docs/DEPLOY.md`: dead `swingby-api.onrender.com` → `swingbyy-api.onrender.com` (verified: old name = Render no-server). `CLAUDE.md`: "MESSAGES locked to confirmed BOOKINGS" is stale — pre-booking chat on quote threads is live + smoke-covered; reword. `docs/RUNNING_LOCALLY.md`: note desktop box has no `backend/.env` — verify against prod with test accounts (login rate limit 5/min/IP). | orchestrator (docs, edit-only) | Files updated; no code touched |
| 8 | **QA regression.** docker pytest full suite + babel parse full mobile/src + `python3 tools/flow_graph.py` regenerate. NO prod smoke tonight (that's Kira's morning gate after push). | qa-agent | All green; 0 broken edges; any break filed to HUMAN-TODO with repro |
| — | NOT tonight: git push (Bucket C — when 1–8 green write READY-TO-PUSH to STATUS), Render/Supabase live state, running e2e_smoke against Render (needs the push first), Telegram brief format redesign (Kira is sending a folder + personal context — wait for it). | | |

**Morning (Kira-gated):** review READY-TO-PUSH → push → Render autodeploy → `python3 tools/e2e_smoke.py https://swingbyy-api.onrender.com` ALL PASS → **Android on-device**: create employee (was 409), open BookingDetails from My Jobs, accept a proposed time from chat (handshake), see date_confirmed on timeline, browse-first Home, General category post.

## 🌙 2026-07-15 overnight queue ✅ COMPLETE (archived — executed 2026-07-15, Opus orchestrator) — PUSHED + DEPLOYED

> **STATUS: all tasks done, all local gates green, NO push (Bucket C = Kira's morning).** Results: CAT-1/2 ✅ (pytest 35/3, black clean) · CAT-3/4 ✅ (babel 115/0) · CAT-5 ✅ (edit-only) · CAT-6 ✅ (pytest 35/3 · babel 115/0 · flow graph 0 broken) · CAT-7 ✅ AUDITED already code-complete (on-device PDF = Bucket B) · CAT-8 ✅ drafted. Detail in STATUS.md + SESSION_LOG (fourth block). Morning: Kira reviews READY-TO-PUSH → push → Render smoke → on-device verify.

> Work in order. Every task Bucket A unless noted. Never push, never deploy, never send. Orchestrator = brain/plan-maker; dispatch implementation to the named agents. Full spec: **Phase CAT below** (approved plan 2026-07-15).

| # | Task | Route | DONE-RULE |
|---|---|---|---|
| 1 | **CAT-1 backend** — new `backend/app/categories.py` + `service_posts.py` (normalize on create, `ilike` on `?category=`, business-feed auto-filter own+RELATED+General) + normalize in `businesses.py`. Spec in Phase CAT. | backend-agent | `py_compile` clean; docker pytest green — 23 existing + new tests all pass |
| 2 | **CAT-2 backend tests** — call-recording in `tests/conftest.py` SupabaseTableStub (backward-compatible) + new `tests/test_service_posts.py` (~8 cases in Phase CAT) | backend-agent | Docker pytest: full suite green, zero existing-test regressions |
| 3 | **CAT-3 mobile taxonomy** — new `mobile/src/constants/categories.js` (8 entries, `landscaping` replaces `lawn`, adds `handyman`); consume in `CategoryScroll.js` (import + re-export `CATEGORIES`), `PostJobScreen.js:39`, `BusinessSetupScreen.js:20`. NO changes to Home/Search/NearbyMap/Dashboard screens. | mobile-agent | Babel parse of all mobile/src: 0 errors; grep confirms no remaining `'lawn'` id or local category arrays in the 3 touched files |
| 4 | **CAT-4 RN fixes** — wrap `mobile/App.js` root in `<GestureHandlerRootView style={{flex:1}}>` (import from react-native-gesture-handler); switch `SafeAreaView` import to `react-native-safe-area-context` in AdminScreen, LoginScreen, SignupScreen, ForgotPasswordScreen, BusinessSetupScreen | mobile-agent | Babel parse 0 errors; grep: no `SafeAreaView` imported from `'react-native'` remains in mobile/src |
| 5 | **CAT-5 smoke prep** — `tools/e2e_smoke.py`: post category `"cleaning"` → `"Cleaning"`; ADD feed-visibility check (business token GET `/service-posts/` → new post id present). Do NOT run against Render tonight (deploy is morning, Kira-gated). | qa-agent | Script py_compiles; diff reviewed against Phase CAT spec |
| 6 | **QA regression** — docker pytest full suite + babel parse full mobile/src + `python tools/flow_graph.py` regenerate | qa-agent | All green; flow graph 0 broken edges; any break filed to HUMAN-TODO with repro |
| 7 | **D2.2 — Invoices** per `Roadmap/dominoes/D2.2-invoices.md` (in-app Receipt screen + downloadable PDF for completed bookings, both roles) — only if 1–6 fully green with retries to spare | backend-agent + mobile-agent | Domino done-rule: receipt shows line items/totals/platform cut/parties; PDF endpoint returns a real PDF; babel + FastAPI boot gates green |
| 8 | **D4 tester kit (draft)** — one-page tester brief + bug-capture sheet supporting `Roadmap/dominoes/D4-friend-tester.md` | marketing-agent (draft only) | Docs exist under Roadmap/dominoes/ or marketing/; nothing sent |
| — | NOT tonight: git push (Bucket C — morning, Kira-gated; when 1–6 green write READY-TO-PUSH to STATUS), Render/Supabase live state, `reviews.reviewee_type` migration, running e2e_smoke against Render (needs the push first) | | |

## 🌞 Today — 2026-07-15 daytime (Kira at work, phone only)

> Written 2026-07-15 morning session. Everything left on the critical path is Kira-gated (Bucket B/C); Claude's daytime lane is tooling + prep only.

**Claude — done this session (Bucket A):**
- ✅ Morning brief → **4-message format** (☀️+🔧 Backend · 📱 Frontend · 🧑 Human TODO · 🌙 Night Recap), multi-bot ready via optional `TELEGRAM_BOT_TOKEN_{BACKEND,FRONTEND,HUMAN,NIGHT}` env vars. Re-imported, re-activated, live-tested (execution 8, 4× ok). Docs: `automation/README.md`.
- ✅ CLAUDE.md Local Dev truth-up: Windows paths → `python3`, LAN IP `10.0.0.53` → `10.0.0.168`.
- ✅ Today plan (this section) + plan pushed to Telegram.

**Kira — from phone at work (optional, ~5 min each):**
- Review the push inventory (in the 🧑 HUMAN TODO Telegram message / STATUS "Waiting On") so the evening push is a rubber-stamp.
- If multi-bot brief wanted: @BotFather → `/newbot` ×4 → paste tokens into `.claude/secrets/n8n.env` (names above) → tell Claude "recreate n8n" tonight. Note: Telegram bots cannot read other bots' messages — this is presentation (per-section name/avatar), coordination stays in n8n.
- GitHub security toggles (Dependabot alerts, secret scanning, push protection) — 2 min in the phone browser.

**Kira — evening gate chain (order matters):**
1. Approve + push `main` (14 modified + 5 new — list in STATUS "Waiting On") → Render autodeploy.
2. `python3 tools/e2e_smoke.py https://swingbyy-api.onrender.com` — ALL PASS incl. new business-feed check.
3. On-device (Expo Go after pull): lawncare feed shows only Landscaping(+General) · gesture error gone · D2.1 trust card · D2.2 PDF receipt (needs a completed booking).
4. D3 walkthrough per `Roadmap/dominoes/D3-expo-go-walkthrough.md` → line up D4 tester (kit drafted, fill `{{EXPO_LINK}}`).
5. Maps key rotation (⛔ Bucket B blocker, steps in HUMAN-TODO).

**Claude — next dispatch (when Kira green-lights):** post-push regression vs Render; then next domino per DOMINOES.md.

## Phase CAT — Category matching + taxonomy unification (approved 2026-07-15)

**Why:** Kira's on-device retest confirmed walkthrough bug #1 — every business sees every open post (lawncare quoted a cleaning job; "Deep massage" labeled Carpentry). Three divergent category lists (`PostJobScreen.js:39` 7 labels · `BusinessSetupScreen.js:20` 8 labels · `CategoryScroll.js:8` lowercase ids incl. broken `lawn`) make browse filters silently return nothing. Kira's decision: business feed = own category + close categories.

**Canonical rule:** `id = label.toLowerCase()`, DB stores capitalized label. Matches existing rows; `ilike` covers legacy lowercase (smoke-created `'cleaning'`); zero migration.

- **`backend/app/categories.py`**: `CANONICAL_CATEGORIES = [Cleaning, Plumbing, Electrical, Landscaping, Painting, Carpentry, Moving, Handyman]`; `GENERAL="General"`; `normalize_category(v)` case-insensitive snap to canonical, unknown passes through stripped; `RELATED` symmetric+conservative: Handyman↔[Carpentry, Painting, Plumbing, Electrical], Carpentry↔Painting, Cleaning/Landscaping/Moving unlinked; `allowed_categories_for(cat)=[own]+RELATED[own]+[General]`. Unit-test symmetry + canonical keys.
- **`service_posts.py`**: create stores `normalize_category(...)`; `?category=` uses `.ilike` (escape `%_\`), param precedence over auto-filter; business auto-filter: no param + role business_owner → look up `businesses.category` by owner_id → `query.or_("category.ilike.X,...")` over allowed. Degrade to UNFILTERED on: no business row, lookup failure, category failing `^[A-Za-z ]+$`. Employees unfiltered for now (comment).
- **Tests** (`tests/test_service_posts.py`, pattern from `test_businesses.py`, `mock_supabase.table.side_effect` for two tables): Handyman owner → or_ contains own+related+General ilikes; no business row → no or_; client role → no lookup; `?category=cleaning` → ilike `Cleaning`, no or_; POST create `"cleaning"` → insert recorded `"Cleaning"`; unit tests on RELATED/normalize.
- **Morning (Kira-gated, NOT tonight):** push → Render autodeploy → `python3 tools/e2e_smoke.py https://swingbyy-api.onrender.com` ALL PASS incl. new feed check → Kira on-device: lawncare dashboard shows only Landscaping(+General) posts; gesture error gone after pull.
- **Risks:** feed quieter by design (RELATED dict is the knob); General visible to all (intended); VirtualizedList warning had NO offender in current tree — stale laptop bundle, re-verify after Kira pulls.

## Goal (beta DONE)
A real tester installs the app, signs up, gets a branded email, posts/finds a job, books, **sees Live Job Status**, completes it, leaves a review — on a real device, payment in sandbox.

---

## Build order (locked by PRODUCT-VISION)
1. ✅ **D1 — Email sends** (SHIPPED 2026-06-21)
2. ✅ **P0 — Kill mock data on Home/Dashboard/Chat** (code already on real APIs per 2026-06-21 audit; E2E confirms with P6)
3. ✅ **P1 — /uploads/image** (code already in `main.py` since `74acaa0`; live 404 is a deploy lag — `git push origin main` ships it)
4. 🟡 **P2 — Transactions sandbox** (Stripe test mode) — code shipped to working tree (backend `payments_stripe.py` + service + config + requirements; mobile `Pay with card` button on BookingDetails). RUNNING IT requires `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in Render env — Bucket B.
5. ✅ **P3 — Live Job Status backend** (booking_events table + RLS + POST/GET events + push on each event — code shipped to working tree, awaits deploy)
6. ✅ **P4 — Live Job Status UI** (LiveStatusActions + LiveStatusTimeline wired into JobManagement + BookingDetails — code shipped, awaits on-device verify)
7. ✅ **P5 — Before/after photos** (booking_photos table + API + BookingPhotos mobile component — code shipped, awaits on-device verify)
8. ✅ **P6 — End-to-end smoke test** (`backend/scripts/smoke_e2e.py` — code shipped, awaits deploy + seed creds to run)
9. ⬜ **D3/D4 — Installable build + real tester run** (post-loop, Kira-driven; needs Apple/Google accounts)

---

## Phase P0 — Mock data verification ✅
| Field | Value |
|---|---|
| 5W+H | WHO testers · WHAT Home/Dashboard/Chat show real data · WHEN now · WHERE mobile/src/screens · WHY fake screens = fake beta · HOW grep + read |
| DONE-RULE | Each screen contains a real `api.get(...)` call and renders empty/loading/error states |
| Status | ✅ DONE — code audit 2026-06-23: `HomeScreen.js:142` `api.get('/businesses/nearby')`; `DashboardScreen.js:205-207` `api.get('/bookings/')` + `/service-posts/` + `/businesses/me`; `ChatScreen.js:270` `api.get('/messages/{bookingId}')` with 5s polling. On-device verification rolls into P6. |
| Bucket | A (just do it — verification only) |

---

## Phase P1 — Fix /uploads/image 404
| Field | Value |
|---|---|
| 5W+H | WHO clients posting jobs · WHAT photo attach works · WHEN now · WHERE backend/app/api/uploads.py + mobile/src/screens/client/PostJobScreen.js · WHY photos = trust + proof · HOW reproduce the call, isolate the path issue |
| DONE-RULE | curl POST to `/uploads/image` with a JPEG returns 200 + URL; on-device PostJob photo attach succeeds |
| Obstacle train | [START] → reproduce 404 with curl → confirm router prefix → inspect mobile FormData → fix → curl green → on-device green → [DONE] |
| Bucket | A (just do it) |
| Status | ⬜ pending |

---

## Phase P2 — Transactions sandbox
| Field | Value |
|---|---|
| 5W+H | WHO tester completing a booking · WHAT pay in Stripe sandbox · WHEN before beta tester run · WHERE backend/app/api/payments_stripe.py + backend/app/services/stripe_service.py + mobile/src/screens/client/BookingDetailsScreen.js · WHY no payment = no beta · HOW Stripe test mode + Checkout Session (hosted) + webhook signature verification |
| DONE-RULE | A booking in test mode goes from confirmed → paid via a Stripe test card; payments row marked `paid_full`; webhook signature verified |
| Bucket | A (code) ✅ shipped + B (Stripe account/keys) pending |
| HUMAN-TODO sub-items | (Bucket B) — create Stripe test account if missing; paste `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (+ optional `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL`) into Render env; configure webhook endpoint `https://swingbyy-api.onrender.com/payments/stripe/webhook` in Stripe Dashboard |
| Status | 🟡 code complete — runtime needs keys + deploy |

---

## Phase P3 — Live Job Status backend
| Field | Value |
|---|---|
| 5W+H | WHO client + business · WHAT see provider's real-time status · WHEN P2 done · WHERE Supabase + backend/app/api/bookings.py · WHY trust = the moat · HOW new `booking_events` table + 3 endpoints + push |
| Obstacle train | [START] → migration: booking_events(id, booking_id, event_type ENUM, actor_id, lat, lng, note, created_at) → RLS policies (read: parties of booking; insert: assigned employee or business owner) → POST `/bookings/{id}/events` (event_type in {arrived,started,completed}) → on each event: insert row + send push to client + (for completed) re-use payment release logic → GET `/bookings/{id}/events` → [DONE] |
| DONE-RULE | All 3 events insert rows + push the client; client and business can GET the event list; access denied for outsiders |
| Bucket | A (code + migration) |
| Status | ⬜ pending |

---

## Phase P4 — Live Job Status UI
| Field | Value |
|---|---|
| 5W+H | WHO testers · WHAT timeline visible · WHEN P3 done · WHERE mobile/src/screens/business/JobManagementScreen.js + mobile/src/screens/client/BookingDetailsScreen.js + new TimelineComponent · WHY proof of work · HOW provider sees three buttons; client sees timeline that polls /events |
| DONE-RULE | Provider taps Arrived → row appears in client's timeline within poll interval; Start + Complete same |
| Bucket | A |
| Status | ⬜ pending |

---

## Phase P5 — Before/after photos
| Field | Value |
|---|---|
| 5W+H | WHO testers · WHAT capture + view before/after · WHEN P4 done · WHERE backend booking_photos table + endpoint + mobile camera + view UI · WHY dispute defense · HOW reuse uploads endpoint + new booking_photos linkage |
| DONE-RULE | Provider attaches before photo → starts job; attaches after photo → completes job. Client sees both on BookingDetails. |
| Bucket | A |
| Status | ⬜ pending |

---

## Phase P6 — End-to-end smoke test
| Field | Value |
|---|---|
| 5W+H | WHO orchestrator · WHAT scripted run of full flow against live Render + Supabase · WHEN P5 done · WHERE backend/scripts/smoke_e2e.py · WHY hand-test is unreliable · HOW Python httpx + seed accounts |
| DONE-RULE | Script exits 0 after: signup-or-login both roles → post → quote → accept → assign → confirm date → arrive → start → upload after photo → complete → review |
| Bucket | A (code + run); reads no secrets, sends no public messages |
| Status | ⬜ pending |

---

## D3 / D4 (post-loop, Kira-driven)
- D3: EAS build (needs Apple Developer + Google Play accounts — Bucket B, deferred per HUMAN-TODO)
- D4: One real tester ride-along (needs recruited tester — FOH task)

---

## FOH (parallel, draft only — never auto-send)
| Task | Agent | Status |
|---|---|---|
| Beta-tester recruiting message + 5 outreach targets | marketing-agent | ⬜ pending |
| Daily morning brief (build + inbox + social) | assistant-agent | ⬜ pending |

---

## Parked (capture, don't chase)
- Self-host Umami analytics next to n8n. ~15 min, revisit when actively driving traffic.
- Phase 5 web reorg (BRIEF Section 5B) — deferred indefinitely per Kira's choice.
