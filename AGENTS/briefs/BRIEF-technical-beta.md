# Agent brief — Technical beta build (BOH / Claude Code)

> Run via the AGENTS orchestrator. Follow claude/config/DISPATCH_GATE.md (all 7 layers). Verify each task before done. Update memory. Never touch secrets. Payment stays SANDBOX. Do tasks in order — each builds on the last.

## T1 — Kill the mock data (CORE — makes the app real)
- WHO testers · WHAT Home/Nearby, Business Dashboard, Chat show REAL data · WHY fake screens = fake beta · WHERE mobile/ · HOW wire to existing endpoints.
- C7: HomeScreen / Nearby → `GET /businesses/nearby` (real businesses, loading/empty/error states).
- C8: Business DashboardScreen → `GET /bookings` + `GET /businesses/me` (real, no placeholders).
- C9: Chat/MessageThread → poll `GET /messages/{booking_id}` every ~5s.
- Acceptance: zero hardcoded/mock arrays left on those screens; real data renders on a device.

## T2 — Before/After photos (proof of work)
- WHO employee/business + client · WHAT employee uploads "before" on arrival + "after" on completion; client sees both · WHERE JobManagementScreen (capture) + BookingDetailsScreen (view).
- Schema: add to bookings → `before_photos text[]`, `after_photos text[]`, `before_uploaded_at timestamptz`, `after_uploaded_at timestamptz` (migration via Supabase MCP).
- Endpoints: `PATCH /bookings/{id}/before-photos`, `PATCH /bookings/{id}/after-photos` (employee/business only). Reuse `/uploads/image` + the job-photos bucket.
- Mobile: two upload boxes gated by booking status; side-by-side viewer for the client.
- Acceptance: photos upload, persist, and the client can view both sets.

## T3 — Live Job Status (the differentiator)
- WHO client watches, provider drives · WHAT a real-time booking timeline: Booked → Arrived → Working → Completed → Reviewed, each step pushing a notification to the client · WHY transparency = trust + dispute defense + on-ramp to auto-release escrow.
- Schema: `booking_events(id, booking_id, type enum[arrived/started/completed], at timestamptz, lat numeric null, lng numeric null)` — OR reuse the photo timestamps + add `arrived_at`. (Agent: pick the cleaner one, document it.)
- Endpoints: `PATCH /bookings/{id}/arrive` (capture one-time lat/lng), `/start`, `/complete` — each timestamps the event AND fires an Expo push to the client (reuse the existing push helper).
- Mobile: provider taps **Arrived / Start / Complete** in JobManagement (one-time location on "Arrived" — NOT background tracking). Client sees the live timeline in BookingDetails.
- Acceptance: provider taps a status → client gets a push + the timeline updates with a timestamp.

## Out of scope for this brief (later)
- Invoices (Jobber-parity) — separate brief.
- Live payments / Stripe — sandbox only for now.
- IoT hardware / smart locks — v3, not now.
