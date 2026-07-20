-- 0002_concurrency_unique_constraints.sql
--
-- PAYMENT-MODEL.md §8 — the backend talks to PostgREST with no transactions,
-- so the database is the only layer that can win a race. Three constraints:
--
--   1. UNIQUE (post_id, business_id) on interests  — stops double-quoting.
--   2. UNIQUE (post_id) on bookings                — stops two concurrent
--      accepts creating two bookings + two payment rows for one job.
--   3. UNIQUE (owner_id) on businesses              — stops a race creating
--      two business rows for one owner, which permanently breaks every
--      `.single()` lookup by owner (PGRST116) with no recovery path.
--
-- Run each ADD CONSTRAINT as its own statement (not inside one failing
-- transaction) so that if production data already has a duplicate blocking
-- one of the three, the other two still land. If a duplicate blocks a
-- constraint below, deduplicate the offending rows first (keep the earliest
-- by created_at) and re-run that one statement.

-- ── interests: one quote per (post, business) ───────────────────────────────
ALTER TABLE interests
  ADD CONSTRAINT interests_post_business_unique UNIQUE (post_id, business_id);

-- ── bookings: one booking per originating post ──────────────────────────────
-- post_id is nullable (direct geo-browse bookings carry none), so this is a
-- partial unique index rather than a table constraint — Postgres treats NULLs
-- as distinct, so multiple NULL post_id bookings remain fine; only a real,
-- shared post_id is protected against a double-accept race.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_post_id_unique
  ON bookings (post_id)
  WHERE post_id IS NOT NULL;

-- ── businesses: one business row per owner ──────────────────────────────────
ALTER TABLE businesses
  ADD CONSTRAINT businesses_owner_id_unique UNIQUE (owner_id);
