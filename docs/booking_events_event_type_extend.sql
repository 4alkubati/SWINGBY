-- CARD-02 — extend booking_events.event_type CHECK for dispute + off-platform events.
-- NOT YET APPLIED to the live project — local/test verification only so far
-- (backend/tests/test_booking_events_check.py). Apply via Supabase MCP
-- `apply_migration` or the SQL Editor once approved.
--
-- Without this, three backend writes violate the CHECK from
-- docs/booking_events_and_photos.sql and fail silently (both call sites
-- swallow the error and only log a warning):
--   backend/app/api/disputes.py             → 'dispute_opened', 'dispute_resolved'
--   backend/app/api/payments_offplatform.py → 'paid_offplatform'
--
-- Same shape as docs/bookings_payment_status_allow_refunded.sql: extend the
-- CHECK rather than drop the writes — the timeline stays the single source
-- of truth for everything that happened on a booking.
--
-- The constraint was created inline (unnamed) in the original DDL, so
-- Postgres auto-named it booking_events_event_type_check.

ALTER TABLE public.booking_events
  DROP CONSTRAINT IF EXISTS booking_events_event_type_check;

ALTER TABLE public.booking_events
  ADD CONSTRAINT booking_events_event_type_check
  CHECK (event_type IN (
    -- original Live Job Status set
    'dates_proposed',
    'date_confirmed',
    'en_route',
    'arrived',
    'started',
    'paused',
    'resumed',
    'completed',
    'cancelled_event',
    -- dispute flow (backend/app/api/disputes.py)
    'dispute_opened',
    'dispute_resolved',
    -- off-platform payment marker (backend/app/api/payments_offplatform.py)
    'paid_offplatform'
  ));
