-- 0001_payment_status_vocabulary.sql
--
-- PAYMENT-MODEL.md §4 — moves payments.status and bookings.payment_status to
-- the single vocabulary in backend/app/services/payment_status.py, backfills
-- existing rows, and adds the explicit `currency` column called for in §3.
--
-- Why this lives here instead of another hand-applied docs/*.sql: this repo's
-- prior practice was loose, unordered SQL files in docs/ applied by hand with
-- no record of what ran where (see backend/migrations placement note in the
-- PR). This is the first of a small, numbered, ordered set — apply in
-- filename order, once, per environment (dev / staging / prod), and record
-- the date in docs/SESSIONS.md the way prior docs/*.sql applications were.
--
-- Before:
--   payments.status         CHECK IN ('pending','partial','paid_full',
--                                      'paid_off_platform','fully_released',
--                                      'refunded','failed')
--   bookings.payment_status CHECK IN ('held','partial_released',
--                                      'fully_released','refunded')
--                            (docs/bookings_payment_status_allow_refunded.sql)
--
-- After (both columns, same enum):
--   'pending_payment' | 'failed' | 'held' | 'partial_released' |
--   'fully_released' | 'refunded' | 'paid_off_platform'
--
-- Ordering that actually works: DROP the old CHECK -> backfill -> ADD the new
-- CHECK. Both constraints have to be out of the way during the backfill: the
-- old one rejects the new values being written, and the new one would reject
-- any not-yet-migrated row. Doing only the latter (the original ordering here)
-- fails with 23514 on the very first UPDATE.
--
-- Backfill mapping (old -> new):
--   payments.status:  'partial'   -> 'partial_released'
--                      'paid_full'-> 'held'
--                      'pending'  -> 'pending_payment'
--   bookings.payment_status: already a subset of the new enum, no backfill
--                            needed (see docs/bookings_payment_status_allow_refunded.sql).

BEGIN;

-- ── payments.currency (§3 — "store an explicit currency column; do not
--    hardcode it in three places") ──────────────────────────────────────────
ALTER TABLE payments ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'CAD';

-- ── payments.status CHECK — DROP FIRST ──────────────────────────────────────
-- The OLD constraint must come off BEFORE the backfill below. The backfill
-- writes NEW-vocabulary values ('partial_released', 'held', 'pending_payment')
-- which the OLD CHECK (pending|partial|paid_full|paid_off_platform|
-- fully_released|refunded|failed) does not allow — so running the UPDATEs
-- first fails with:
--   23514 new row for relation "payments" violates check constraint
--         "payments_status_check"
-- Confirmed against prod 2026-07-22. The original ordering here only
-- considered the *new* constraint catching old rows, and missed that the
-- *old* constraint is still enforcing during the backfill.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;

-- ── payments.status backfill (old -> new vocabulary) ────────────────────────
UPDATE payments SET status = 'partial_released' WHERE status = 'partial';
UPDATE payments SET status = 'held' WHERE status = 'paid_full';
UPDATE payments SET status = 'pending_payment' WHERE status = 'pending';

ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status = ANY (ARRAY[
    'pending_payment'::text,
    'failed'::text,
    'held'::text,
    'partial_released'::text,
    'fully_released'::text,
    'refunded'::text,
    'paid_off_platform'::text
  ]));

-- ── bookings.payment_status CHECK — extend to the full shared enum ─────────
-- (previously only held | partial_released | fully_released | refunded, per
-- docs/bookings_payment_status_allow_refunded.sql; now the same 7 values as
-- payments.status so both columns speak one vocabulary.)
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status = ANY (ARRAY[
    'pending_payment'::text,
    'failed'::text,
    'held'::text,
    'partial_released'::text,
    'fully_released'::text,
    'refunded'::text,
    'paid_off_platform'::text
  ]));

COMMIT;
