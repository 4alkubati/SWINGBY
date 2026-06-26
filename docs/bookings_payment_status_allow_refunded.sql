-- Applied via Supabase MCP on 2026-06-25.
-- Extends bookings.payment_status CHECK to include 'refunded'.
--
-- Without this, PATCH /bookings/{id}/cancel raises a CHECK violation
-- because backend/app/api/bookings.py:347 writes payment_status='refunded'
-- when a booking is cancelled.
--
-- Decision shape A from HUMAN-TODO: extend the CHECK rather than drop the
-- write. Keeps refund state on the booking row so mobile pill display and
-- business analytics can read a single enum without cross-table joins.

ALTER TABLE bookings DROP CONSTRAINT bookings_payment_status_check;

ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status = ANY (ARRAY[
    'held'::text,
    'partial_released'::text,
    'fully_released'::text,
    'refunded'::text
  ]));
