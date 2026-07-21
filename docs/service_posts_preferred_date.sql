-- Migration: add preferred_date to service_posts.
-- Written 2026-07-18 for GAP-AUDIT-2026-07-18 #63 (surfaced again by #3's
-- backend edit route, which lists preferred_date as an editable field).
-- The mobile job-post wizard already collects a date/time and
-- SendQuoteSheet.js already reads `post.preferred_date` defensively — the
-- column just doesn't exist yet. Additive, nullable — no backfill needed.
-- STATUS: APPLIED to prod (verified by introspection 2026-07-21).
-- service_posts.preferred_date exists. Note the pre-existing typo column
-- `preffered_date` is still present and must never be written. See
-- docs/MIGRATIONS.md.

ALTER TABLE public.service_posts
    ADD COLUMN IF NOT EXISTS preferred_date TIMESTAMPTZ;

COMMENT ON COLUMN public.service_posts.preferred_date IS
    'Client-preferred date/time for the job. Nullable — set at post-create '
    '(PostJobScreen, not yet wired — GAP #63) or post-edit (PATCH '
    '/service-posts/{id}, GAP #3).';
