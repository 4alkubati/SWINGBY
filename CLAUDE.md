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

## Database — 19 tables (live schema)

All RLS enabled. **Query live Supabase before trusting this table — docs drift.**
Verified against the live schema 2026-07-22.

Core:

| Table | Key columns |
|---|---|
| `users` | id, **first_name, last_name**, email, phone, role (client/business_owner/employee/admin), avatar_url, deleted_at, is_suspended, is_ghosted, stripe_customer_id, default_payment_method_id |
| `businesses` | owner_id, business_name, category, custom_category, lat/lng, service_radius_km, avg_rating, review_count, license_status, subscription_tier/status/id, stripe_customer_id |
| `employees` | business_id, user_id, role_title, avatar_url, is_active |
| `service_posts` | client_id, title, category, budget, address, image_urls, status, expires_at (+7d), lat/lng, preferred_date, target_business_id |
| `interests` | post_id, business_id, quoted_price, status (pending/accepted/rejected) |
| `bookings` | client_id, business_id, employee_id, post_id (nullable), service_category, total_amount, commission_rate, platform_fee, status, payment_status, proposed_date_1/2/3, confirmed_date, date_proposed_by |
| `payments` | booking_id, total_charged, escrow_held, released_to_business, platform_cut (10%), stripe_payment_intent_id, status, method, currency |
| `messages` | booking_id, sender_id, content, sent_at, interest_id, read_at |
| `reviews` | booking_id, reviewer_id, reviewee_id, reviewee_type, rating (1-5), comment |
| `cancellations` | booking_id, cancelled_by, reason, penalty_amount |
| `booking_events` | booking_id, actor_id, event_type, note, lat, lng — live status timeline |
| `booking_photos` | booking_id, uploaded_by, phase, url, path, caption — proof of work |

Also live (not in the original 12): `disputes`, `referrals`, `user_credits`,
`audit_log`, `push_tokens`, `stripe_events`, `business_work_index` (semantic
search corpus + embedding).

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
- **Code-flow graph → `docs/FLOW_GRAPH.md` + `docs/flow-graph.json`** — every screen ↔ screen edge, backend routes vs mobile calls, orphans in red. **Read this FIRST for any nav / 404 / dead-end question** — cheaper than scanning screen files. Regenerate: `python3 tools/flow_graph.py`. How-to: `~/brain/10-swingby/agents/claude/automation/FLOW_GRAPH.md`.
- **Booking-loop smoke test → `tools/e2e_smoke.py`** — full post→quote→accept→booking→complete journey with response-SHAPE checks against a local backend (`python tools/e2e_smoke.py [base_url]`). **Mandatory before accepting any change to the booking loop** (DISPATCH_GATE Layer 6). Uses the test accounts above.
- Notion nudge layer → `~/brain/10-swingby/agents/claude/config/NOTION_SYNC.md` — database ID, schema, query pattern, drift-check rule
- Orchestrator briefs → `~/brain/10-swingby/agents/briefs/BRIEF-*.md`
- New-project scaffolder → `~/brain/docs/KICKOFF.md` (invoked by the user-level `kira-kickoff` skill)
- Roadmap → `Roadmap/`

**The brain:** the agent kit lives at `~/brain/10-swingby/agents/` (its own git repo); this repo keeps a gitignored `AGENTS` symlink pointing there, so `AGENTS/...` paths still resolve on this box.

**Sync rule:** agent-behavior changes (gates, routing, loop, skills) are edited in `~/brain/10-swingby/agents/` and committed to the brain's git BEFORE being applied in a live session.
