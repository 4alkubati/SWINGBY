# SwingBy — Master Context for Claude Code

> Source of truth for every session. Keep tight — long-form context lives in `docs/`.

---

## What is SwingBy

Dual-sided service marketplace connecting service providers (**Businesses**) with people seeking services (**Clients**). Uber meets Thumbtack meets Facebook Marketplace — built for Calgary, expanding North America.

**Two roles:** Business (solo or company) | Client (person needing a service)
**Two discovery flows:** Geo-browse (map, nearby) | Post & match (client posts, businesses bid)
**Booking flow:** Client posts → Business expresses interest → Client accepts → Booking created → Employee assigned → Date confirmed → Completed

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI (Python 3.14) — `backend/` |
| Database | PostgreSQL via Supabase (project `ulnxapnsenzyddddldjt`, ca-central-1) |
| Mobile | React Native + Expo SDK 54 — `mobile/` |
| Web pre-launch | React + Vite — `web/pre-launch/` — deployed |
| Web launch | React + Vite — `web/launch/` — 40+ routes, analytics, i18n EN/FR/AR |
| Web admin | React + Vite — `web/admin/` — platform analytics dashboard |
| Workers | Cloudflare — `workers/waitlist` |
| Auth | FastAPI JWT (backend is auth layer; mobile uses expo-secure-store key `swingby_token`) |
| Storage | Supabase Storage bucket `job-photos` (public read, 10 MB, images only) |
| Payments | Stripe (sandbox wired) — escrow split logic in backend |
| Maps | Google Maps API (placeholder key, real key for Phase 5) |
| Push | Expo Push + FCM (post-MVP) |
| Project nudges | Notion (connected MCP, same tier as Google Calendar) — "SwingBy" database mirrors Roadmap/DOMINOES + Launch Checklist, flags overdue/blocked/gate items. Read-only nudge layer, not source of truth — see `~/brain/10-swingby/agents/claude/config/NOTION_SYNC.md` |
| CRM (separate) | ~~`backend/app/services/notion_crm.py`~~ — **removed.** This module and `NOTION_CRM_DB_ID` no longer exist anywhere in the repo (SB-0050); the row survived the deletion and sent readers looking for a file that is not there. `NOTION_TOKEN` is still read, by the waitlist endpoint. |

---

## Monorepo

```
SwingBy/
├── backend/        FastAPI — see docs/API.md for endpoints
├── mobile/         RN + Expo — screens bucketed: auth, onboarding, admin, business, client, flows, messages, profile, shared
├── web/
│   ├── pre-launch/ Coming-soon + waitlist
│   ├── launch/     Full launch site (40+ routes)
│   └── admin/      Platform analytics
├── workers/        Cloudflare Workers
├── docs/           API.md, SECURITY.md, SESSIONS.md, RUNNING_LOCALLY.md, DEPLOY.md, ROLLBACK.md, schema, RLS, ops
├── AGENTS          gitignored symlink → ~/brain/10-swingby/agents/ (agent kit: orchestrator, BOH/FOH, memory — lives in the brain)
├── design/         Design system — START AT design/DESIGN-SYSTEM.md ("Jet × Pulse", binding)
├── marketing/      Content, emails, social
└── CLAUDE.md       this file
```

---

## Database — 10 Tables + booking_events + booking_photos

All RLS enabled. Schema details in `docs/swingby_database_schema.md`.

| Table | Purpose |
|---|---|
| `users` | id, name, email, phone, role (client/business_owner/employee/admin), avatar_url |
| `businesses` | owner_id, business_name, category, lat/lng, service_radius_km, avg_rating, license_status |
| `employees` | business_id, user_id, role_title, is_active |
| `service_posts` | client_id, title, category, budget, address, image_urls, status, expires_at (+7d) |
| `interests` | post_id, business_id, quoted_price, status (pending/accepted/rejected) |
| `bookings` | client_id, business_id, employee_id, post_id (nullable), total_amount, status, payment_status |
| `payments` | booking_id, total_charged, escrow_held, released_to_business, platform_cut (10%), status |
| `messages` | booking_id, sender_id, content, sent_at |
| `reviews` | booking_id, reviewer_id, reviewee_id, reviewee_type, rating (1-5), comment |
| `cancellations` | booking_id, cancelled_by, reason, penalty_amount |
| `booking_events` | booking_id, event_type, note, created_at — live status timeline |
| `booking_photos` | booking_id, url, caption — proof of work |

**Payment escrow.** SwingBy keeps **10%** (`escrow.PLATFORM_RATE`), business gets 90%.

> ⚠ Corrected 2026-07-29. This line used to describe a **50% on confirmation /
> 50% on completion** staged release and a **25%/50%** cancellation penalty.
> Neither matches the code, and a session trusting it would "fix" working money
> logic into a wrong shape. `partial_released` is marked in `escrow.py:12` as a
> *"legacy partial state (kept for back-compat)"* — there is no staged release
> any more. Money is charged before service and released on completion/approval.
> **`backend/app/services/escrow.py` is the authority for every figure below.**

**Cancellation ladder** — `escrow.compute_cancellation_split()`, and it matches
the user-facing copy in `mobile/src/screens/shared/TermsOfServiceScreen.js`
verbatim. Keep those two in step; that text is what the client agreed to.

| Who cancels | When | Client refund | Business keeps |
|---|---|---|---|
| Client | no date confirmed yet | 100% | 0% |
| Client | >48h before the date (`early`) | **100%** | **0%** |
| Client | ≤48h before (`late`) | 75% | 25% |
| Client | date already passed (`no_show`) | 50% | 50% |
| Business | any time | 100% | 0% |

No platform cut is taken on a cancellation — a retained penalty goes entirely to
the business.

**Nothing is charged when a client posts a job.** The charge-at-post trigger
(TRIGGER 1) is wired but **gated OFF** in `api/service_posts.py` — it cannot
capture in this schema (no matched business, so no agreed price; no `bookings`
row for the NOT NULL `payments.booking_id`; no card on file). `payment_started`
on the create response is therefore always `false`. Money is collected at
**accept**, via `mobile/src/services/acceptAndPay.js`. Turning post-time capture
on needs Stripe SetupIntent / card-on-file, which does not exist in this repo.
Do not write client-facing copy that says otherwise — that claim shipped once
and had to be pulled (2026-07-29).

**Post expiry** (`services/expiry_sweep.py`): if a post expires with no accepted
quote, any escrow held against it is **refunded immediately** — not held. Today
that is normally a no-op, because nothing was charged at post; the sweep is
written for it (a missing payment row and a zero-escrow row are both expected
and skipped). It is the half that would make charging up front defensible if
card-on-file ever lands, so do not make it conditional or deferred (Kira's
ruling, 2026-07-29).

---

## Key Design Decisions

- **One USERS table, four roles** — role checked per route
- **INTERESTS as spam shield** — no direct contact before client accepts
- **post_id nullable on BOOKINGS** — supports both post-and-match AND direct geo-browse flows
- **MESSAGES span the quote → booking arc** — pre-booking chat is live on quote/interest threads (unified `/messages/threads`, smoke-covered), then continues on the booking once accepted. Not gated behind a confirmed booking.
- **LICENSE_STATUS manual** — pending → manual verify by SwingBy team (auto post-MVP)
- **service_role key backend-only** — never direct Supabase from frontend
- **Haversine geo-browse** — bounding box pre-filter in Supabase + exact distance in Python (no PostGIS needed for MVP)

---

## Moderation — report, block, filter (App Store Guideline 1.2)

Added 2026-07-31. The app carries user-generated content on six surfaces (chat,
voice notes, reviews, job posts, proof-of-work photos, avatars), which is what
makes all of this mandatory rather than optional.

Tables: `content_reports`, `user_blocks`, plus a nullable `hidden_at` on
`messages` / `reviews` / `service_posts` / `booking_photos`
(migration `20260731090000_ugc_reports_and_blocks.sql`).

Three rules worth knowing before you touch any of it:

- **Blocks are stored one-way, enforced symmetrically.**
  `user_blocks` has a `blocker_id → blocked_id` direction, but
  `services/visibility.py::blocked_pair_ids` returns BOTH sides and every
  enforcement point uses that. A one-way block would let the abuser keep
  initiating, which is the behaviour Guideline 1.2(c) exists to stop. Enforced
  in `messages.py` (send → 403, inbox, thread reads), `service_posts.py` (feed),
  `businesses.py` (all three discovery paths), `interests.py` (quoting).
  Composes with `hidden_user_ids` — a feed drops the union.

- **`hidden_at` is a soft hide, never a delete.** Read paths filter
  `hidden_at is null`; the row survives for the admin trail and, on `messages`,
  for the same CRA-retention posture `me.py` documents. Adding a new read path
  over any of those four tables means adding the filter.

- **`content_moderation.py` is not a profanity filter, on purpose.** Blocking
  "shit" annoys every tradesperson and catches no abuser. Hard-block is slurs,
  sexual solicitation and threats; general profanity only FLAGS (stores +
  auto-files a report) and only when aimed at a person. Matching happens against
  a normalised form where character runs are collapsed to one — so a term added
  to a list must be written in collapsed form, or it will silently never match.
  See the false-positive matrix in `tests/test_content_moderation.py` before
  adding anything.

Admin review is **in-app** (`Admin → Reported content` → `ReportQueueScreen`),
not `web/admin/`, which is not deployed. `services/moderation.py::suspend_user`
is shared with `api/admin.py` so the two cannot drift.

---

## Deployment

- Pre-launch site: https://swingbyy.com (Cloudflare Pages project `swingby-prelaunch`)
- Waitlist Worker: https://api.swingbyy.com/waitlist (Cloudflare Worker `swingby-waitlist`)
- Cloudflare Account ID: `4877404e65143359d52e1056bfd8099c`
- Zone ID (swingbyy.com): `9a8b894bb479321547e40824477d46f5`
- Repo: https://github.com/4alkubati/SWINGBY (branch `main`)

---

## Local Dev

**Backend** (from `backend/`):
```
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Mobile** (from `mobile/`):
```
npx expo start --clear
```

**`.env` keys** (backend): `DATABASE_URL`, `SECRET_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY` (required — hard-fails without it), `RESEND_API_KEY`, `STRIPE_SECRET_KEY`.

**Machine info:** Linux box, LAN IP `10.0.0.168` → physical-device URL `http://10.0.0.168:8000`. Android emulator → `http://10.0.2.2:8000`. Both via `EXPO_PUBLIC_API_URL` in `mobile/.env`.

---

## Knowledge graph — query it before you grep

`graphify` maps this monorepo (8.7k nodes / 14.8k edges) into `graphify-out/`
(gitignored, 27 MB). **Locating code by query is far cheaper than repeated
`grep`/`Read` sweeps**, which is the single biggest token cost in a session.

```
graphify update .                              # rebuild — AST/tree-sitter, ~60s, NO LLM, zero tokens
graphify query "how does escrow release" --budget 1500
graphify god-nodes --top 10                    # architectural hubs
graphify affected "compute_completion_release_cents"   # reverse impact — what breaks if I change X
graphify path "PostJobScreen" "release_escrow_on_complete"
graphify explain "settle_on_accept"
```

**It is a locator, not an oracle.** It returns nodes with `file:line`, not
prose — use it to decide *what to Read*, then read only those files. Verify the
code itself before acting; the graph tells you where, not whether.

⚠️ **`affected` under-reports module-qualified calls, and it has already
mattered.** `graphify affected "compute_completion_release_cents"` returns 2
callers; `grep -rn` returns **3**. The one it misses is
`api/proof_of_work.py:302`, which calls it as
`escrow.compute_completion_release_cents(...)` — and that caller carried the
*identical* money bug (F010, 2026-08-10) as the two it does find. Scoping that
fix from the graph alone would have shipped half of it. **For a change that
moves money, confirm the caller list with `grep` before you trust the graph.**

Rebuild after any significant merge — it is a snapshot, and a stale graph points
at moved line numbers. Regenerating costs nothing but a minute.

Two known gaps: 5 JSX files partially extract (bare `&` in JSX text, e.g.
`BusinessProfileScreen.js:698` "Services & pricing" — valid React, a tree-sitter
quirk, **not a real syntax error**), and doc/PDF/image semantic passes need an
LLM key, so only code + SQL are currently mapped.

Complements `docs/FLOW_GRAPH.md`, which stays the authority for screen↔screen
navigation and route/orphan questions.

---

## Test Credentials

- Client: `testclient@swingby.dev` / `SwingBy2024!`
- Business: `testbusiness@swingby.dev` / `SwingBy2024!` (**Douglas Glen Cleaning
  Co.**, Calgary — this said "Test Cleaning Co." until 2026-08-12; read from the
  live row, not from here, if it matters). **It has an active non-owner employee
  ("Cleaner") plus two inactive ones**, so it is a *multi-staff* business and
  takes the "must assign someone before completing" branch of the W3 guard — it
  will never exercise the solo-owner auto-assign path.
- Admin: `amrbasem37@gmail.com`

---

## Reference Docs

- API endpoints → `docs/API.md`
- Security checklist → `docs/SECURITY.md`
- Session history → `docs/SESSIONS.md`
- Running locally → `docs/RUNNING_LOCALLY.md`
- Deploy / Rollback → `docs/DEPLOY.md`, `docs/ROLLBACK.md`
- DB schema → `docs/swingby_database_schema.md`
- **Code-flow graph → `docs/FLOW_GRAPH.md` + `docs/flow-graph.json`** — every screen ↔ screen edge, backend routes vs mobile calls, orphans in red. **Read this FIRST for any nav / 404 / dead-end question** — cheaper than scanning screen files. Regenerate: `python3 tools/flow_graph.py`. How-to: `~/brain/10-swingby/agents/claude/automation/FLOW_GRAPH.md`.
- **Booking-loop smoke test → `tools/e2e_smoke.py`** — full post→quote→accept→booking→complete journey with response-SHAPE checks against a local backend (`python tools/e2e_smoke.py [base_url]`). **Mandatory before accepting any change to the booking loop** (DISPATCH_GATE Layer 6). Uses the test accounts above.
- **Bug ledger → `docs/bugs/ledger.jsonl`, driven by `tools/bugctl.py`; skill `/deepscan`.** Every finding has a permanent id (`SB-0001`), a status, and a **verify step** — the literal check that proves it fixed. `bugctl close` refuses without one, which is what stops the "I think I already fixed that" loop that produced the backlog. Never hand-edit the jsonl or the generated `docs/bugs/LEDGER.md`.
  - `bugctl next` only hands out findings re-verified as still broken. If it is empty, run the VERIFY pass — do not pick a bug at random.
  - **A finding not in the ledger did not happen.** Reporting a bug without filing it is how the last four months of findings evaporated.
  - `~/brain/inbox/SENTINEL-findings.md` (~40 findings, ~half stale) is **not yet migrated** — it is a log, not a queue. Migration procedure in `.claude/skills/deepscan/references/LEDGER.md`.
  - Coverage of what has actually been swept: `docs/bugs/COVERAGE.md`.
- Notion nudge layer → `~/brain/10-swingby/agents/claude/config/NOTION_SYNC.md` — database ID, schema, query pattern, drift-check rule
- Orchestrator briefs → `~/brain/10-swingby/agents/briefs/BRIEF-*.md`
- New-project scaffolder → `~/brain/docs/KICKOFF.md` (invoked by the user-level `kira-kickoff` skill)
- Roadmap → `Roadmap/`

**The brain:** the agent kit lives at `~/brain/10-swingby/agents/` (its own git repo); this repo keeps a gitignored `AGENTS` symlink pointing there, so `AGENTS/...` paths still resolve on this box.

**Sync rule:** agent-behavior changes (gates, routing, loop, skills) are edited in `~/brain/10-swingby/agents/` and committed to the brain's git BEFORE being applied in a live session.
