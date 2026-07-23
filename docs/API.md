# SwingBy Backend API

Base URL (local): `http://127.0.0.1:8000` | Swagger: `/docs` | OpenAPI: `/openapi.json`

**Generated from the live FastAPI app** (`app.openapi()`), not hand-maintained. Regenerate the list with:

```bash
cd backend && python -c "
from app.main import app
s = app.openapi()
for p, ops in sorted(s['paths'].items()):
    for m in ops: print(m.upper(), p)
"
```

**80 operations** are registered (78 API + 2 health probes).

Every route requires `Authorization: Bearer <access_token>` **except** the ones marked
**public** below: `/auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/forgot-password`,
`/waitlist/`, `/contact/`, `/payments/stripe/webhook`, `/health`, `/healthz`.

Roles: `client`, `business_owner`, `employee`, `admin`.

---

## Auth — `/auth`

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/auth/signup` | public | 5/min. Creates `users` row (`first_name`/`last_name`). |
| POST | `/auth/login` | public | 5/min + per-email/IP lockout. |
| POST | `/auth/refresh` | public | 10/min. Body: `{refresh_token}`. |
| POST | `/auth/logout` | any | Revokes the session. |
| POST | `/auth/forgot-password` | public | 3/min. Always returns 200 (no user enumeration). |
| GET | `/auth/me` | any | Profile; business owners also get their business. |
| PATCH | `/auth/me` | any | Update name/phone/avatar. |

## Businesses — `/businesses`

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/businesses/` | business_owner | One business per owner. |
| GET | `/businesses/` | any | List/search. |
| GET | `/businesses/nearby?lat=&lng=&radius_km=` | any | Haversine geo-browse (bbox pre-filter + exact distance in Python). |
| GET | `/businesses/me` | business_owner, employee | Employees resolve via their `employees` row. |
| GET | `/businesses/me/analytics` | business_owner | 30/min. Earnings, bookings, categories, reviews. |
| GET | `/businesses/{business_id}` | any | |
| PATCH | `/businesses/{business_id}` | business_owner (own) | |

## Subscriptions — mounted under `/businesses`

| Method | Path | Who |
|---|---|---|
| POST | `/businesses/me/subscribe` | business_owner |
| GET | `/businesses/me/subscription` | business_owner |

## Employees — `/employees`

| Method | Path | Who |
|---|---|---|
| POST | `/employees/` | business_owner |
| GET | `/employees/` | business_owner (own business) |
| GET | `/employees/business/{business_id}` | any |
| GET | `/employees/{employee_id}/profile` | any |
| PATCH | `/employees/{employee_id}/deactivate` | business_owner |
| PATCH | `/employees/{employee_id}/reactivate` | business_owner |

## Service Posts — `/service-posts`

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/service-posts/` | client | Geocodes `address` → `lat`/`lng`, `geocoded_at`, `geocode_source`. |
| GET | `/service-posts/` | any | Open posts (geo-filterable). |
| GET | `/service-posts/my` | client | |
| GET | `/service-posts/{post_id}` | any | |
| PATCH | `/service-posts/{post_id}` | client (own) | |
| DELETE | `/service-posts/{post_id}` | client (own) | Soft cancel → `status='cancelled'`. |

## Interests — `/interests`

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/interests/` | business_owner | Quote on a post. |
| GET | `/interests/mine` | business_owner | |
| GET | `/interests/post/{post_id}` | client (own post) | |
| PATCH | `/interests/{interest_id}/accept` | client (own post) | **Creates booking + payment atomically**, rejects siblings. |
| PATCH | `/interests/{interest_id}/reject` | client (own post) | |

## Bookings — `/bookings`

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/bookings/` | any | Scoped by role. |
| GET | `/bookings/{booking_id}` | booking party | |
| PATCH | `/bookings/{booking_id}/assign-employee` | business_owner | |
| PATCH | `/bookings/{booking_id}/propose-dates` | booking party | **Required step of the core loop.** Writes `proposed_date_1..3` + `date_proposed_by`, emits a `dates_proposed` booking event. |
| PATCH | `/bookings/{booking_id}/confirm-date` | the *other* party | Sets `confirmed_date`; the proposer cannot confirm their own proposal. |
| PATCH | `/bookings/{booking_id}/complete` | business_owner, employee | Releases the second escrow half. |
| PATCH | `/bookings/{booking_id}/cancel` | booking party | Writes a `cancellations` row + penalty. |

Core loop: post → interest → **accept** → **propose-dates** → **confirm-date** → events/photos → **complete** → review.

## Booking events — mounted under `/bookings`

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/bookings/{booking_id}/events` | provider side | `event_type` must match the DB CHECK — see `docs/swingby_database_schema.md`. |
| GET | `/bookings/{booking_id}/events` | booking party | Live status timeline. |

## Booking photos — mounted under `/bookings`

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/bookings/{booking_id}/photos` | provider side | `phase` ∈ `before`, `after`. |
| GET | `/bookings/{booking_id}/photos` | booking party | |

## Invoices — mounted under `/bookings`

| Method | Path | Who |
|---|---|---|
| GET | `/bookings/{booking_id}/invoice` | booking party |
| GET | `/bookings/{booking_id}/invoice.pdf` | booking party |

## Payments — `/payments`

| Method | Path | Who |
|---|---|---|
| GET | `/payments/mine` | client, business_owner |
| GET | `/payments/{booking_id}` | booking party |

### Stripe — `/payments/stripe`

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/payments/stripe/checkout/{booking_id}` | client | Creates a Checkout Session. **Not** `/payments/stripe/intent`. |
| POST | `/payments/stripe/webhook` | public | Signature-verified. |

### Off-platform — mounted under `/bookings`

| Method | Path | Who |
|---|---|---|
| POST | `/bookings/{booking_id}/mark-paid-offplatform` | client (own booking) |

## Disputes — `/disputes`

| Method | Path | Who |
|---|---|---|
| POST | `/disputes/` | booking party |
| GET | `/disputes/mine` | any |
| PATCH | `/disputes/{dispute_id}/resolve` | admin |

## Reviews — `/reviews`

| Method | Path | Who |
|---|---|---|
| POST | `/reviews/` | booking party |
| GET | `/reviews/business/{business_id}` | any |
| GET | `/reviews/client/{client_id}` | any |
| GET | `/reviews/employee/{employee_user_id}` | any |

## Messages — `/messages`

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/messages/` | thread party | Targets a `booking_id` **or** an `interest_id`. |
| GET | `/messages/threads` | any | Unified pre-booking + booking inbox. |
| GET | `/messages/unread-count` | any | |
| GET | `/messages/interest/{interest_id}` | thread party | |
| GET | `/messages/{booking_id}` | booking party | |

## Me — `/me`

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/me/export` | any | 5/min. GDPR/PIPEDA data export. |
| GET | `/me/referrals` | any | Reads the `referrals` table. |
| DELETE | `/me` | any | 1/hour. Soft delete → `users.deleted_at`. |

## Push tokens — `/push-tokens`

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/push-tokens/register` | any | Upsert on `(user_id, token)`. **There is no delete route.** |

## Uploads — `/uploads`

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/uploads/image` | any | Supabase Storage bucket `job-photos`. |
| DELETE | `/uploads/image` | any | |

## Admin — `/admin` (role `admin`, all 30/min unless noted)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/users` | |
| GET | `/admin/bookings` | |
| GET | `/admin/waitlist-count` | |
| POST | `/admin/suspend-user/{user_id}` | Sets `users.is_suspended`. |
| POST | `/admin/unsuspend-user/{user_id}` | |
| POST | `/admin/force-complete-booking/{booking_id}` | |
| GET | `/admin/monitoring-probe` | 5/min. |

There is **no** `GET /admin/businesses`.

## Public

| Method | Path | Notes |
|---|---|---|
| POST | `/waitlist/` | |
| POST | `/contact/` | 5/min. |
| GET | `/health` | Pings the DB. |
| GET | `/healthz` | Liveness only, no DB call. |
