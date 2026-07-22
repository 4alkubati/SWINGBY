---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build]
---
# QA Audit — Full "Uber-flow" walk-through (2026-07-16)

Backend verified live against prod (`https://swingbyy-api.onrender.com`), DB inspected via Supabase,
mobile verified statically + bundle compile. Standard smoke (`tools/e2e_smoke.py`): **25/25 PASS on prod**.
Extended flow (assign employee → propose date → confirm date → Stripe checkout → live events →
complete → review): **passes end-to-end** once an employee exists — but getting there surfaced the
bugs below.

## P0 — blocks the core loop

### 1. Employee creation is broken in prod (409 on `users` insert)
`POST /employees/` → 400 "Could not create employee" every time.
Supabase API logs show the real error: `POST /rest/v1/users → 409 Conflict`.
A DB trigger on `auth.users` already auto-inserts the `public.users` row when
`supabase.auth.admin.create_user()` runs, so the explicit insert at
`backend/app/api/employees.py:78` collides and the whole endpoint fails.
The trigger-created row also has `role='client'` and empty names — so the fix must
**update** (role, first_name, last_name, phone) instead of insert.
**Impact:** no business can ever add an employee → `assign-employee` can never run →
proposed dates never exist → client can never confirm a date. The entire scheduling
chain is dead for every real business. (Test Cleaning Co. had 0 employees; one was
inserted manually via SQL to verify the rest of the chain works — it does.)

### 2. BookingDetails is unreachable in normal navigation
`BookingDetailsScreen` is the only screen with **Pay with card** (Stripe checkout),
**mark-paid-offplatform**, and the client-side **LiveStatusTimeline**. The only ways in:
- tapping a notification (`NotificationsCenterScreen.js:61`)
- deep link `booking/:bookingId` (`services/linking.js`)

No screen calls `navigate('BookingDetails')`. My Jobs → ActiveBooking has **no pay button
and no live timeline**. A client who misses the push can never pay and never sees
"someone is on the way". Fix: link My Jobs / ActiveBooking → BookingDetails (or merge the
two screens).

### 3. No confirm-date UI anywhere in mobile
No screen calls `PATCH /bookings/{id}/confirm-date`. Business can propose dates
(JobManagementScreen:251) but the client has no picker to accept one. Endpoint verified
working (moves booking to `in_progress`, sends push + email to business). UI missing.

## P1 — degrades the experience

### 4. `confirm-date` writes no booking_event
Timeline after confirmation shows only `['en_route', 'arrived', ...]` — no
`date_confirmed` entry. If the business misses the push/email there is no in-app record
on the timeline. Add a `date_confirmed` event type (backend `_ALLOWED_EVENT_TYPES` +
insert in confirm_date).

### 5. Date confirmation is skippable
`complete` works straight from `confirmed` status (first smoke run completed a booking
that never had a confirmed date). Decide: enforce date confirmation before en_route /
complete, or accept it as optional.

### 6. Taxonomy has no category for personal services
"Deep massage" job was filed under **Carpentry** (screenshot IMG_1401). Canonical list
(`backend/app/categories.py`) is trades-only: Cleaning, Plumbing, Electrical,
Landscaping, Painting, Carpentry, Moving, Handyman. Anything else gets shoehorned.
Note: the business-feed category filter itself **verified working in prod** — a Cleaning
business correctly sees zero of the open Carpentry/Electrical/Plumbing posts. The
screenshots showing a Landscaping business receiving Carpentry/Plumbing leads came from
the laptop dev build running pre-Phase-CAT backend code.

## P2 — hygiene / drift

### 7. VirtualizedLists-in-ScrollView console error (screenshot IMG_1400)
Not reproducible in this repo's HEAD — the only FlatList+ScrollView combos are safe
(modal sheet in JobManagement, horizontal carousel in BusinessProfile). Stack trace paths
are `C:\Users\amrba\OneDrive\...` → the laptop's diverged copy. Sync the laptop repo
before chasing this.

### 8. Doc drift
- `docs/DEPLOY.md` says `https://swingby-api.onrender.com`; real service is
  `https://swingbyy-api.onrender.com` (the former returns Render `no-server`).
- `CLAUDE.md` still says "MESSAGES locked to confirmed BOOKINGS" — pre-booking chat on
  quote threads has existed since the interests-chat work and is covered by the smoke test.

### 9. No backend/.env on this machine
Desktop box can't run the backend locally (docs assume it can). Prod + test accounts
used instead. Either restore `backend/.env` here or note in RUNNING_LOCALLY.md that this
box tests against prod.

## Decisions from Amr (2026-07-16, post-audit interview)

- **Categories:** keep the trades taxonomy; anything off-taxonomy (e.g. massage) files under
  **General** — visible to all businesses and findable via search. No new category groups for now.
- **Client home:** browse-first. The Browse/Post toggle at the top of Home goes away —
  dashboard opens straight into browsing; **Post a job moves to the bottom** (bottom nav / FAB).
- **Mobile bundle health:** `expo export` compiles clean at HEAD (via `docker run node:20`) —
  the dev-build console error is laptop-copy drift, not this repo.

## Verified working (no action)

- Full booking loop on prod: post → quote → pre-booking chat → accept → booking →
  chat migration → en_route/arrived events → complete → escrow `fully_released`.
- Assign-employee + propose dates → confirm-date → `in_progress` + push/email to business.
- Stripe checkout session creation (real `cs_test_...` URL returned).
- Review submission post-completion.
- Business-feed category filtering (Phase CAT) on prod.

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]

**Related:** [[2026-07-16]] · [[CLAUDE]] · [[RUNNING_LOCALLY]]
<!-- graph-wire:end -->
