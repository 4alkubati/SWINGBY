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
| CRM (separate) | `backend/app/services/notion_crm.py` — best-effort sync of new signups to a Notion leads DB via `NOTION_TOKEN`/`NOTION_CRM_DB_ID`. Unrelated to the nudge DB above |

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
├── design/         Mockups, system
├── marketing/      Content, emails, social
└── CLAUDE.md       this file
```

---

## Database — 16 Tables

RLS enabled on all 16, every table has policies. Columns/constraints verified against prod
2026-07-21 → `docs/swingby_database_schema.md`. **Never trust a `.sql` file in `docs/` as
proof a change is applied — query prod.** See `docs/MIGRATIONS.md`.

| Table | Purpose |
|---|---|
| `users` | id, **first_name + last_name** (there is no `name`), email, phone, role (client/business_owner/employee/admin), avatar_url, deleted_at (soft delete), is_suspended |
| `businesses` | owner_id, business_name, category, lat/lng, service_radius_km, avg_rating, license_status |
| `employees` | business_id, user_id, role_title, is_active |
| `service_posts` | client_id, title, category, budget, address, image_urls, status, expires_at (+7d), `preferred_date`, geocoded_at/geocode_source — a dead typo column `preffered_date` also exists, never write it |
| `interests` | post_id, business_id, quoted_price, status (pending/accepted/rejected) |
| `bookings` | client_id, business_id, employee_id, post_id (nullable), total_amount, status, payment_status, proposed_date_1/2/3, confirmed_date (**no** `completed_at`, **no** `scheduled_date`) |
| `payments` | booking_id, total_charged, escrow_held, released_to_business, platform_cut (10%), status, method (**no** `notes`) |
| `messages` | booking_id **or** interest_id, sender_id, content, sent_at, read_at |
| `reviews` | booking_id, reviewer_id, reviewee_id, reviewee_type (business/client/employee), rating (1-5), comment |
| `cancellations` | booking_id, cancelled_by, reason, penalty_amount |
| `booking_events` | booking_id, actor_id (**ON DELETE RESTRICT**), event_type, note, lat/lng — live status timeline |
| `booking_photos` | booking_id, uploaded_by (**ON DELETE RESTRICT**), phase (before/after), url, path, caption — proof of work |
| `disputes` | booking_id, opened_by, against_party, issue_type, status, refund_amount — admin-resolved |
| `referrals` | code, referrer_id, referee_id (nullable), status, credit_cents |
| `push_tokens` | user_id, token, platform — unique on (user_id, token) |
| `audit_log` | actor_id, action, resource_type/id, metadata jsonb, ip |

**Payment escrow:** 50% released on confirmation, 50% on completion (minus 10% platform cut → business gets 90% total). Cancel penalty: 25% if >48h before date, 50% if ≤48h.

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

## Test Credentials

- Client: `testclient@swingby.dev` / `SwingBy2024!`
- Business: `testbusiness@swingby.dev` / `SwingBy2024!` (Test Cleaning Co., Calgary)
- Admin: `amrbasem37@gmail.com`

---

## Reference Docs

- API endpoints → `docs/API.md`
- Security checklist → `docs/SECURITY.md`
- Session history → `docs/SESSIONS.md`
- Running locally → `docs/RUNNING_LOCALLY.md`
- Deploy / Rollback → `docs/DEPLOY.md`, `docs/ROLLBACK.md`
- DB schema → `docs/swingby_database_schema.md`
- **Migrations → `docs/MIGRATIONS.md`** — how to apply, how to verify applied state, and the same-PR rule. Read before touching any `.sql` file or any insert/update payload.
- **Code-flow graph → `docs/FLOW_GRAPH.md` + `docs/flow-graph.json`** — every screen ↔ screen edge, backend routes vs mobile calls, orphans in red. **Read this FIRST for any nav / 404 / dead-end question** — cheaper than scanning screen files. Regenerate: `python3 tools/flow_graph.py`. How-to: `~/brain/10-swingby/agents/claude/automation/FLOW_GRAPH.md`.
- **Booking-loop smoke test → `tools/e2e_smoke.py`** — full post→quote→accept→booking→complete journey with response-SHAPE checks against a local backend (`python tools/e2e_smoke.py [base_url]`). **Mandatory before accepting any change to the booking loop** (DISPATCH_GATE Layer 6). Uses the test accounts above.
- Notion nudge layer → `~/brain/10-swingby/agents/claude/config/NOTION_SYNC.md` — database ID, schema, query pattern, drift-check rule
- Orchestrator briefs → `~/brain/10-swingby/agents/briefs/BRIEF-*.md`
- New-project scaffolder → `~/brain/docs/KICKOFF.md` (invoked by the user-level `kira-kickoff` skill)
- Roadmap → `Roadmap/`

**The brain:** the agent kit lives at `~/brain/10-swingby/agents/` (its own git repo); this repo keeps a gitignored `AGENTS` symlink pointing there, so `AGENTS/...` paths still resolve on this box.

**Sync rule:** agent-behavior changes (gates, routing, loop, skills) are edited in `~/brain/10-swingby/agents/` and committed to the brain's git BEFORE being applied in a live session.
