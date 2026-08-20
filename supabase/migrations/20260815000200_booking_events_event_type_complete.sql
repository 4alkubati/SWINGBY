-- 20260815000200_booking_events_event_type_complete.sql
--
-- SWEEP 2026-08-15, finding F3 — six backend writes violate the
-- booking_events.event_type CHECK, and every one of them is swallowed.
--
-- SUPERSEDES docs/booking_events_event_type_extend.sql, WHICH IS INCOMPLETE.
-- That file (header: "NOT YET APPLIED to the live project") adds three values.
-- The backend writes SIX that the CHECK rejects. Applying it verbatim would fix
-- half the problem and leave the other half failing exactly as silently — and
-- the half it misses includes `payment_released`, the row that records escrow
-- moving to the business, i.e. the single most important entry in a booking's
-- money trail.
--
-- The CHECK, created inline (unnamed, so Postgres auto-named it
-- booking_events_event_type_check) in docs/booking_events_and_photos.sql:23-32,
-- allows nine values. Every write below is outside it:
--
--   value                     | written at                            | swallowed by
--   --------------------------|---------------------------------------|--------------------------
--   dispute_opened            | api/disputes.py:153                   | except -> logger.warning
--   dispute_resolved          | api/disputes.py:495                   | except -> logger.warning
--   paid_offplatform          | api/payments_offplatform.py:141       | except -> logger.warning
--   payment_released          | services/approvals.py:180 (_event)    | except -> logger.warning
--   payment_requested         | services/payment_triggers.py:223      | except -> logger.debug
--   payment_requested_failed  | services/payment_triggers.py:215      | except -> logger.debug
--
-- Nothing surfaces. The schema comment calls this table the single source of
-- truth for everything that happened on a booking, and today it silently omits
-- every dispute, every off-platform payment, and every escrow release.
--
-- The three `payment_*` values are the ones docs/booking_events_event_type_extend.sql
-- never knew about, because they are written through indirection —
-- `_event(booking_id, actor_id, event_type, note)` and
-- `_record_event(...)` — rather than as a literal at the insert site, so the
-- grep that produced that file's list did not see them.
--
-- api/booking_events.py:49-59 keeps its own `_ALLOWED_EVENT_TYPES` set for the
-- client-facing POST route, and it stays the original nine on purpose: these
-- six are written by the server, never posted by an app.

begin;

alter table public.booking_events
    drop constraint if exists booking_events_event_type_check;

alter table public.booking_events
    add constraint booking_events_event_type_check
    check (event_type in (
        -- original Live Job Status set (docs/booking_events_and_photos.sql)
        'dates_proposed',
        'date_confirmed',
        'en_route',
        'arrived',
        'started',
        'paused',
        'resumed',
        'completed',
        'cancelled_event',
        -- dispute flow (api/disputes.py)
        'dispute_opened',
        'dispute_resolved',
        -- off-platform payment marker (api/payments_offplatform.py)
        'paid_offplatform',
        -- escrow lifecycle (services/approvals.py, services/payment_triggers.py)
        'payment_requested',
        'payment_requested_failed',
        'payment_released'
    ));

commit;

-- ── Verification, after applying ───────────────────────────────────────────
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'booking_events_event_type_check';
-- Expect all 15 values. Then confirm the timeline is no longer lossy:
--   select event_type, count(*) from public.booking_events group by 1 order by 1;
