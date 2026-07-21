-- users_is_ghosted.sql
-- Adds the in-app "ghost mode" flag to public.users.
--
-- Ghost mode is a user-initiated, reversible privacy state that is DISTINCT
-- from admin suspension (is_suspended) and account deletion (deleted_at):
--   * is_ghosted  -> user hides themselves from discovery / becomes unbookable
--   * is_suspended-> admin-imposed lockout (blocks auth)
--   * deleted_at  -> soft-deleted account (blocks auth, PII scrubbed)
--
-- A ghosted business owner's business stops appearing in geo-browse
-- (businesses /nearby, /) and the owner can no longer express interest on
-- posts. A ghosted client's open service posts stop appearing in the
-- business-facing feed (service-posts /). Existing bookings and message
-- threads are unaffected. The flag lifts automatically on next login.
--
-- Idempotent: safe to re-run.

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_ghosted boolean NOT NULL DEFAULT false;

-- Partial index: the discovery filters only ever care about the (rare) ghosted
-- rows, so index just those.
CREATE INDEX IF NOT EXISTS idx_users_is_ghosted
    ON public.users (id)
    WHERE is_ghosted = true;
