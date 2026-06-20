# SwingBy — Master Context for Claude Code

> This file is the single source of truth for every Claude session.
> Update it at the end of each significant session before closing.

---

## What is SwingBy

Dual-sided service marketplace app connecting service providers ("Businesses") with people seeking services ("Clients"). Think Uber meets Thumbtack meets Facebook Marketplace — built for Calgary, expanding to North America.

**Two user roles:** Business (solo hustler or company) | Client (person needing a service)  
**Two discovery flows:** Geo-browse (map, nearby businesses) | Post & match (client posts, businesses bid)  
**Booking flow:** Client posts → Business expresses interest → Client accepts → Booking created → Employee assigned → Date confirmed → Completed

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI (Python) |
| Database | PostgreSQL via Supabase |
| Mobile | React Native + Expo (not started) |
| Web Dashboard | React + Vite — `web/` directory |
| Auth | Supabase Auth |
| Storage | AWS S3 (not needed until file uploads) |
| Maps | Google Maps API |
| Push | Expo Push + FCM |
| Caching | Redis — post-MVP only |

---

## Supabase Project

- **Project name:** SWINGBY
- **Project ID:** `ulnxapnsenzyddddldjt`
- **Region:** ca-central-1
- **URL:** stored in `backend/.env` as `SUPABASE_URL`
- **Keys:** `SUPABASE_KEY` (anon) and `SUPABASE_SERVICE_KEY` (service role) — both in `backend/.env`, never committed

---

## Monorepo Structure

```
SwingBy/
├── backend/                    ← FastAPI (Python) — COMPLETE
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             ← All 9 routers registered
│   │   ├── database.py         ← SQLAlchemy engine (health check only)
│   │   ├── supabase_client.py  ← Service role client, hard-fails if key missing
│   │   ├── deps.py             ← get_current_user JWT dependency
│   │   └── api/
│   │       ├── auth.py         ← signup, login, GET /me, PATCH /me
│   │       ├── businesses.py   ← CRUD + GET /nearby (Haversine geo)
│   │       ├── employees.py    ← create, list, deactivate, reactivate
│   │       ├── service_posts.py← create, list, get, cancel
│   │       ├── interests.py    ← express, list, accept→(booking+payment), reject
│   │       ├── bookings.py     ← list, get, assign-employee, confirm-date, complete, cancel
│   │       ├── payments.py     ← get payment by booking
│   │       ├── reviews.py      ← create, get by business/client
│   │       └── messages.py     ← send, list by booking
│   └── requirements.txt
├── mobile/                     ← React Native + Expo — NOT STARTED
├── web/                        ← React + Vite — IN PROGRESS (website)
│   └── src/
│       ├── pages/
│       ├── components/
│       └── services/
├── docs/
│   ├── rls_policies.sql        ← APPLIED to Supabase ✅
│   ├── expiry_cron.sql         ← APPLIED to Supabase ✅
│   └── swingby_database_schema.md
└── CLAUDE.md                   ← this file
```

---

## Database — 10 Tables (all in Supabase)

All have RLS enabled with policies applied.

| Table | Key fields |
|---|---|
| `users` | id (uuid), first_name, last_name, email, phone, role (client/business_owner/employee), avatar_url |
| `businesses` | id, owner_id→users, business_name, category, lat, lng, service_radius_km, avg_rating, review_count, license_status |
| `employees` | id, business_id→businesses, user_id→users, role_title, is_active |
| `service_posts` | id, client_id→users, title, category, budget, status (open/matched/expired/cancelled), expires_at (+7 days) |
| `interests` | id, post_id→service_posts, business_id→businesses, quoted_price, status (pending/accepted/rejected) |
| `bookings` | id, client_id, business_id, employee_id, post_id, total_amount, status (confirmed/in_progress/completed/cancelled), payment_status |
| `payments` | id, booking_id, total_charged, escrow_held, released_to_business, platform_cut (10%), status |
| `messages` | id, booking_id, sender_id, content, sent_at |
| `reviews` | id, booking_id, reviewer_id, reviewee_id, reviewee_type (client/business), rating (1-5), comment |
| `cancellations` | id, booking_id, cancelled_by, reason, penalty_amount |

**Payment escrow logic:**
- On booking confirmed: 50% released to business, 50% held
- On job complete: remaining 50% minus 10% platform cut released (business gets 90% total)
- On cancel: 25% penalty if >48h before date, 50% penalty if ≤48h

---

## Backend API — All Endpoints

Base URL: `http://127.0.0.1:8000` | Docs: `/docs`  
All routes require `Authorization: Bearer <token>` except signup/login/health.

```
POST   /auth/signup
POST   /auth/login
GET    /auth/me
PATCH  /auth/me

POST   /businesses/
GET    /businesses/
GET    /businesses/me
GET    /businesses/nearby?lat=&lng=&radius_km=     ← Haversine geo-browse
GET    /businesses/{id}
PATCH  /businesses/{id}

POST   /employees/
GET    /employees/
PATCH  /employees/{id}/deactivate
PATCH  /employees/{id}/reactivate

POST   /service-posts/
GET    /service-posts/
GET    /service-posts/my
GET    /service-posts/{id}
DELETE /service-posts/{id}

POST   /interests/
GET    /interests/post/{post_id}
PATCH  /interests/{id}/accept              ← creates booking + payment atomically
PATCH  /interests/{id}/reject

GET    /bookings/
GET    /bookings/{id}
PATCH  /bookings/{id}/assign-employee
PATCH  /bookings/{id}/confirm-date
PATCH  /bookings/{id}/complete
PATCH  /bookings/{id}/cancel

GET    /payments/{booking_id}

POST   /reviews/
GET    /reviews/business/{business_id}
GET    /reviews/client/{client_id}

POST   /messages/
GET    /messages/{booking_id}

GET    /health
```

---

## How to Run Backend

```bash
cd backend
pip install -r requirements.txt
"C:/Python314/python.exe" -m uvicorn app.main:app --reload
```

**Required `.env` keys:**
```
DATABASE_URL=postgresql://...
SECRET_KEY=...
SUPABASE_URL=https://ulnxapnsenzyddddldjt.supabase.co
SUPABASE_KEY=sb_publishable_...
SUPABASE_SERVICE_KEY=eyJhbGci...    ← REQUIRED — server refuses to start without it
AWS_BUCKET=                          ← leave empty until file uploads needed
```

---

## Security Status — Full Checklist

| Item | Status |
|---|---|
| RLS on all 10 tables | ✅ Applied via MCP — 0 advisor warnings |
| No table open to anon | ✅ Zero anon policies |
| Service role key backend-only | ✅ Never in mobile/ or web/ |
| `.env` not in git | ✅ Confirmed via git ls-files |
| All 33 routes auth-protected | ✅ 2 intentionally open (signup/login) |
| Input validation on all models | ✅ Pydantic Field constraints + EmailStr |
| supabase_client hard-fails if key missing | ✅ RuntimeError at startup |
| Post expiry cron (hourly, pg_cron) | ✅ Live on Supabase |
| JWT expiry | ✅ 3600s default (free plan, not configurable) |
| Email confirmation | ⚠️ Check: Auth → Sign In / Providers → Email → "Confirm email" ON |
| AWS S3 bucket | ⚪ Not needed — using Supabase Storage instead |
| Supabase Storage bucket job-photos | ✅ Created 2026-06-15 — public read, 10 MB limit, images only |
| Image upload endpoint /uploads/image | ✅ backend/app/api/uploads.py — validates type+size, auth-protected |
| CSP headers (_headers for Cloudflare/Netlify) | ✅ web/launch/public/_headers |
| Admin role in DB constraint | ✅ wave-5-admin-role.sql applied, amrbasem37@gmail.com = admin |
| CI secret scan + npm audit | ✅ .github/workflows/web-launch-ci.yml |
| react-router-dom XSS (GHSA-2w69) | ✅ Upgraded to 6.30.4 |
| xlsx prototype pollution (no npm fix) | ✅ Replaced with ExcelJS |

---

## Website Plan (web/ directory)

**Two versions to build:**

### Version 1 — Pre-launch ✅ DONE (`web/pre-launch/`)
- Coming soon / waitlist page with email capture

### Version 2 — Full launch ✅ DONE (`web/launch/`)
- 40+ routes: marketing, auth, app/dashboard (client + business)
- Analytics (Recharts), Earnings ledger, CSV/XLSX exports (ExcelJS)
- Webhook form, API keys management
- CSP headers, Sentry, Plausible analytics, WCAG 2.1 AA
- Pending: Stripe payment UI, GET /businesses/me/analytics backend endpoint,
  POST /api-keys backend endpoint + migration

---

## Key Design Decisions (do not change without reason)

- **One USERS table, three roles** — role checked on every protected route
- **INTERESTS as spam shield** — businesses express interest, client accepts or rejects. No direct contact before confirmation
- **post_id nullable on BOOKINGS** — supports both post-and-match AND direct geo-browse flows
- **Escrow split** — 50% on confirmation, 50% on completion, 10% platform cut from second payout
- **MESSAGES locked to confirmed BOOKINGS only** — no pre-booking chat
- **LICENSE_STATUS manual** — starts as pending, SwingBy team verifies manually. Auto-verification post-MVP
- **service_role key in backend only** — all data operations go through FastAPI, never direct Supabase from frontend
- **Haversine geo-browse** — bounding box pre-filter in Supabase + exact distance in Python. No PostGIS needed for MVP

---

## GitHub

Repo: https://github.com/4alkubati/SWINGBY  
Branch: main

---

## Session Log

| Date | What was done |
|---|---|
| 2026-05-13 | Built entire backend — 9 API modules, all endpoints, auth dependency |
| 2026-05-14 | Added auth/me, geo-browse, input validation, supabase hardening, orphan cleanup |
| 2026-05-14 | Applied all RLS policies to Supabase via MCP, expiry cron live, 0 security warnings |
| 2026-05-16 | Starting web/ — pre-launch website (Version 1) |
| 2026-06-07–08 | Built web/launch/ — full launch site (Workstreams A–E, 5 commits pushed) |
| 2026-06-10 | Autonomous 100-task polish run: ESLint fix (eslint-plugin-react), 404/maintenance polish, OG image SVG, skeleton loaders, share buttons, print CSS, anchor scroll, hyperlocal SEO pages (17 live), 7 email templates + 3 drip sequences, 4-week IG content, 28 FB posts, 30 founder LinkedIn posts, customer story templates; n8n social automation workflows wired by founder in parallel |
| 2026-06-15 | Full cross-platform audit (backend+mobile+web+design+AGENTS orchestrator directory). Fixed: photo upload in PostJobScreen (expo-image-picker + /uploads/image backend + Supabase Storage bucket job-photos), address field now sent to backend (image_urls + address columns added to service_posts), ForgotPasswordScreen created + POST /auth/forgot-password endpoint + wired in AuthNavigator, LoginScreen Forgot password? link activated, Supabase Storage RLS policies applied, comprehensive ORCHESTRATOR_ISSUES.md created (36 issues tracked across CRITICAL/HIGH/MEDIUM/LOW/DESIGN). |
