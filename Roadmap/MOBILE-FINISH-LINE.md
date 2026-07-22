---
group: plan
project: swingby
hub: "[[MOC-Plan]]"
tags: [plan]
---
# Mobile app — finish-line plan

Written 2026-07-01 after the flow-graph clean pass. Goal: get the mobile app to "everything runs, everything reachable, nothing 404s" for beta.

Current state per `docs/FLOW_GRAPH.md`:
- 0 broken navigation edges
- 0 orphan screens (Map deleted this session)
- 2 broken API calls remaining (below)
- 56 registered screens, 65 backend routes, 70 mobile API calls

## What's actually blocking "done"

### 1. Two backend gaps (broken API calls)

**F1 — `GET /payments/mine` (Earnings list)**
- **Symptom:** business owner opens Dashboard → Earnings → screen shows nothing / errors
- **Cause:** `payments.py` only exposes `GET /payments/{booking_id}`, no list endpoint
- **Fix:** add `GET /payments/mine` returning payments for the caller's business
- **Scope:** ~30 min. Backend only.

**F2 — Disputes router (dispute submit)**
- **Symptom:** BookingDetails "Report a problem" → DisputeFlow → submit → 404
- **Cause:** no `disputes.py` router in backend at all
- **Fix:** new table `disputes`, RLS, `disputes.py` with POST create + GET list-mine + admin resolve
- **Scope:** ~half day. Backend + DB migration.

### 2. E2E verification (manual, needs a device)

Once F1 + F2 are in, walk through:

**Client golden path**
1. Sign up as client → sees Onboarding → Home
2. Search a business by category → BusinessProfile → PostJob
3. Businesses send interests → QuoteComparison → accept one → ActiveBooking
4. Message the business → Chat
5. Business marks completed → BookingDetails → View receipt → Invoice PDF opens
6. Rate the business → Review
7. Profile → Payment methods, Notifications, Favorites, Invite friends, Settings — all reach their screens

**Business golden path**
1. Sign up as business_owner → BusinessSetup → Dashboard
2. Dashboard chips → Earnings, Analytics, Team all load
3. Open Jobs → JobManagement → assign employee → complete → View receipt
4. My Business → Account menu → Notifications, Payment methods, Settings, Help, Privacy, Terms — all reach their screens
5. My Business → Team → Manage → EmployeeManagement
6. JobManagement → Report a problem → DisputeFlow

**Auth golden path**
1. Onboarding → Signup → Login flow works both directions
2. Login → ForgotPassword returns to Login after reset
3. Employee login lands on employee dashboard (not client — was a bug earlier)

### 3. Edge cases to hit before beta

- Kill the network mid-fetch → error state shows retry
- Log in with expired token → redirect to Login (not white screen)
- Post a job with no photos → still submits
- Post a job with the max 5 photos → all upload
- Accept two interests same second → server-side lock rejects the second
- Cancel a booking >48h out → 25% penalty
- Cancel a booking ≤48h out → 50% penalty
- Off-platform mark-as-paid → invoice shows "PAID (OFF-PLATFORM)"

## How to verify each without a device

I (Claude) can verify:
- Backend runs, `/health` returns ok
- `docs/flow-graph.json` shows 0 broken edges + 0 orphans
- Metro bundler compiles all screens without JS syntax error
- Every mobile API call has a matching backend route (broken_api list empty)
- OpenAPI schema matches the expected endpoint list

I (Claude) CANNOT verify:
- What renders on-screen (needs a device or emulator + eyes)
- Whether taps land where they look like they should
- Animation / gesture correctness

## Ordering

Ship in this order:

- **F1** — payments list endpoint  *(30 min, unblocks Earnings)*
- **F2** — disputes router + table  *(half day, unblocks DisputeFlow)*
- Re-run flow graph — expect **0 broken api**
- Boot backend + Metro locally, confirm bundle
- Kira runs the three golden paths on a device, reports any issue
- Fix whatever Kira reports
- Second full pass on device
- If second pass clean → **mobile-app-done for beta**

## Not blocking beta (parking lot)

- Push notifications (post-MVP per CLAUDE.md)
- License auto-verification (currently manual per CLAUDE.md)
- Google Maps real API key (using placeholder for now)
- Admin analytics dashboard (`web/admin/` — separate surface)

<!-- graph-wire:start -->
---
**Up:** [[MOC-Plan]] · **Home:** [[SWINGBY]]

**Related:** [[2026-07-01]] · [[CLAUDE]]
<!-- graph-wire:end -->
