# PLAN.md — Active Plan

> Written by Orchestrator. Every task framed through DISPATCH_GATE Layer 1 (5W+H) before it lands here.
> **Mode: AUTONOMOUS + GATED** per `config/LOOP.md`. 3-bucket gate (A: just do it · B: park to HUMAN-TODO · C: hard-stop).

## Project: SwingBy
## Repo: /home/l3thal/agents/projects/swingby

---

## 🌙 Tonight — overnight queue (queued 2026-07-14, run via `automation/run-overnight.sh`)

> Work in order. Every task Bucket A unless noted. Never push, never deploy, never send.

| # | Task | Route | DONE-RULE |
|---|---|---|---|
| 1 | **D2.2 — Invoices** per `Roadmap/dominoes/D2.2-invoices.md` (in-app Receipt screen + downloadable PDF for completed bookings, both roles) | backend-agent + mobile-agent | Domino done-rule: receipt shows line items/totals/platform cut/parties; PDF endpoint returns a real PDF; babel + FastAPI boot gates green |
| 2 | **QA regression** — `python tools/e2e_smoke.py` against local backend + regenerate flow graph (`python tools/flow_graph.py`) | qa-agent | Smoke exits 0; flow graph 0 broken edges/API calls; any break filed to HUMAN-TODO with repro |
| 3 | **D4 tester kit (draft)** — one-page tester brief + bug-capture sheet supporting `Roadmap/dominoes/D4-friend-tester.md` (Jul 15 run) | marketing-agent (draft only) | Docs exist under Roadmap/dominoes/ or marketing/; nothing sent |
| 4 | **Beta-tester recruiting message + 5 outreach targets** (PLAN FOH backlog item) | marketing-agent (draft only) | Drafts in marketing/; sending = Bucket C, never auto |
| — | NOT tonight: `reviews.reviewee_type` employee migration (schema change unattended = no), any git push (Bucket C), anything touching live Render/Supabase state | | |

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
