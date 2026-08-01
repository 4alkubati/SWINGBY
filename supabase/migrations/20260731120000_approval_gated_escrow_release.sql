-- 20260731120000_approval_gated_escrow_release.sql
--
-- THE ESCROW WAS NOT ESCROW — 2026-07-31
--
-- Found on the first iOS device walkthrough. Two endpoints released money to the
-- business:
--
--   POST  /bookings/{id}/proof/approve   client approves   → release   (correct)
--   PATCH /bookings/{id}/complete        BUSINESS marks it → release   (wrong)
--
-- `complete_booking` is gated to business_owner/employee — a client calling it
-- gets a 403 — and it called release_escrow_on_complete() directly. So the
-- business marked its own job done and paid itself, with the client nowhere in
-- the path. Caught live on the dashboard: Cleared went $75 -> $237 while escrow
-- held stayed flat at $160, the $18 difference being the 10% platform cut.
--
-- Meanwhile the pay sheet tells the client, verbatim:
--     "Held in escrow — released only when you approve the work."
-- and the App Store description says the same thing. Both were false.
--
-- RULING (Kira, 2026-07-31): the client's approval releases the money. If the
-- client goes quiet, it auto-releases to the business after 24 HOURS.
--
-- WHY A COLUMN AND NOT A NEW STATUS
-- ---------------------------------
-- `bookings.status` stays 'completed' when the business marks the work done,
-- because that is true — the JOB is finished. What is not finished is the
-- MONEY, and that already has its own field: `payment_status` stays 'held'
-- until the release happens. Adding a new status value would have meant a CHECK
-- migration plus auditing every consumer of `status` in the app, for a fact
-- `payment_status` already expresses.
--
-- Live data at the time of writing (500-row sample): every one of the 27
-- 'completed' bookings is also 'fully_released'. After this change 'completed'
-- can legitimately mean "held, awaiting approval", so anything that inferred
-- "completed therefore paid out" has to read payment_status instead.
--
-- Additive and idempotent: one nullable column and one partial index.

begin;

alter table public.bookings
  add column if not exists approval_deadline_at timestamptz;

comment on column public.bookings.approval_deadline_at is
  'When the client''s window to approve completed work expires. Set to now()+24h by PATCH /bookings/{id}/complete. NULL once the money has been released (by approval or by the deadline passing), so a non-null value with payment_status=''held'' is exactly the set awaiting settlement.';

-- The settle query is "completed, still held, deadline passed". Partial, because
-- the awaiting-approval set is tiny next to the table and everything else is
-- permanently irrelevant to it.
create index if not exists bookings_awaiting_approval_idx
  on public.bookings (approval_deadline_at)
  where approval_deadline_at is not null;

commit;
