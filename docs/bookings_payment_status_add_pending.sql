-- CARD-21 — extend bookings.payment_status CHECK for the Uber money model.
-- NOT YET APPLIED to the live project — filed for database-agent / Kira
-- review. Do not apply against live Supabase from this card (backend-agent
-- does not own schema changes; see CARD-21 hard rules).
--
-- Old model: accept_interest wrote payment_status='partial_released' the
-- instant a booking was created (50% "released" before any Stripe payment
-- existed). CARD-21 replaces that with the Uber model — full capture at
-- Stripe Checkout confirmation, held on the platform balance, business paid
-- only at completion. The new lifecycle needs a state for "booking exists,
-- nothing paid yet":
--
--   accept_interest        -> payment_status = 'pending'   (NEW — not in the current CHECK)
--   webhook: checkout done -> payment_status = 'held'       (already allowed, previously unused)
--   complete_booking       -> payment_status = 'fully_released' (already allowed)
--   cancel_booking         -> payment_status = 'refunded'   (already allowed)
--
-- Without this migration, backend/app/api/interests.py's accept flow
-- (post-CARD-21) writes payment_status='pending' and will violate
-- bookings_payment_status_check until this is applied — same failure shape
-- as the pre-existing 'refunded' gap fixed by
-- docs/bookings_payment_status_allow_refunded.sql. CARD-21 code ships with
-- this migration UNAPPLIED (per instructions); it is a hard NEEDS-KIRA
-- blocker before this card can run against live Supabase.
--
-- Same extend-don't-drop shape as the prior two payment_status /
-- booking_events CHECK migrations in this directory.

ALTER TABLE bookings DROP CONSTRAINT bookings_payment_status_check;

ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status = ANY (ARRAY[
    'pending'::text,
    'held'::text,
    'partial_released'::text,
    'fully_released'::text,
    'refunded'::text
  ]));
