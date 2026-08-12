-- Read-only facts about production. No writes, ever — status.py refuses
-- to send anything containing a write keyword, checked before the query
-- reaches the connection.
--
-- Each block starts with "-- name: <label>". The label is the heading
-- that appears on the status page. Everything before the first "-- name:"
-- is preamble and is not sent.
--
-- SCHEMA NOTES (verified against production 2026-08-12, not assumed):
--   * `bookings` has NO `updated_at` and no `modified_at`. An earlier draft
--     of this file used `updated_at` and errored. `approval_deadline_at` is
--     the right column and is semantically better — it IS the window
--     deadline, so "aging past the window" becomes exact rather than a
--     proxy for it.
--   * the pending payment_status is `pending_payment`, NOT `pending`. An
--     earlier draft filtered `NOT IN ('held','pending')` and so counted an
--     unpaid booking as money-already-moved.
--   * `approvals.AWAITING = "held"` — there is no `awaiting_approval`
--     value. completed + held IS "awaiting client approval".
--   Full domain, 2026-08-12: fully_released, held, pending_payment, refunded.

-- name: Bookings by assignment, status, payment
-- Answers candidate C first: is employee_id ever actually NULL in prod?
-- If the unassigned=true rows are all zero, the whole escrow item is
-- theoretical and drops down the list. (2026-08-12: it is not — 254 of 263.)
SELECT (employee_id IS NULL) AS unassigned,
       status,
       payment_status,
       count(*) AS n
FROM bookings
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 4 DESC;

-- name: Unassigned bookings that already moved money
-- The leak, if it exists. Any row here is candidate A, confirmed.
SELECT status, payment_status, count(*) AS n
FROM bookings
WHERE employee_id IS NULL
  AND payment_status NOT IN ('held', 'pending_payment')
GROUP BY 1, 2
ORDER BY 3 DESC;

-- name: Held payments aging past the approval window
-- The opposite failure — candidate B, money stuck rather than leaked.
-- Kept as a SEPARATE block on purpose: one result must not be able to
-- collapse A and B into a single answer. They can both be true.
SELECT (employee_id IS NULL) AS unassigned,
       count(*) AS n,
       min(approval_deadline_at) AS oldest_deadline
FROM bookings
WHERE payment_status = 'held'
  AND status = 'completed'
  AND approval_deadline_at IS NOT NULL
  AND approval_deadline_at < now() - interval '48 hours'
GROUP BY 1;
