-- =====================================================================
-- APPLY-2026-07-20.sql — consolidated migrations
-- =====================================================================
--
-- STATUS: **APPLIED.** Verified against prod by introspection on 2026-07-21.
-- All six sections are live: service_posts.preferred_date, users.is_suspended,
-- the widened booking_events_event_type_check, reviews_reviewee_type_check
-- (now allows 'employee'), service_posts.geocoded_at + geocode_source, and the
-- referrals table with its RLS policies. Every statement is idempotent, so
-- re-running it is a no-op — keep the file as the audit trail, and re-run
-- STEP 0 any time you want to re-confirm. See docs/MIGRATIONS.md.
--
-- WHY THIS FILE EXISTS
-- Several migrations in docs/ are marked "FILE ONLY -- do not apply to prod"
-- while code on main already reads or writes the columns they create. Each of
-- those is a production failure waiting for the first request that hits it.
-- On 2026-07-20 exactly that class of bug was found live: /payments/mine and
-- /disputes/mine were returning 500 because two columns the code selected had
-- never existed. See PR #24.
--
-- HOW TO RUN
-- Supabase dashboard -> SQL Editor -> paste -> Run.
--   https://supabase.com/dashboard/project/ulnxapnsenzyddddldjt/sql
-- Run STEP 0 first, on its own. It only reads. Its output tells you which of
-- the sections below are actually needed. Then run the whole file if you like:
-- every statement is idempotent and safe to run twice.
--
-- WHY list_migrations WON'T HELP
-- These are raw-SQL migrations. They never register in Supabase's migration
-- table, so the only honest check is information_schema / pg_constraint —
-- which is what STEP 0 does.
--
-- NOT INCLUDED ON PURPOSE
-- docs/bookings_payment_status_add_pending.sql and docs/payment_ledger_table.sql
-- live on the card-21-money branch and must be applied WITH that merge, not
-- before it. Applying them early is harmless; merging that branch before them
-- 500s every quote acceptance.


-- =====================================================================
-- STEP 0 — VERIFY (read-only; run this first)
-- =====================================================================
WITH expected(section, kind, obj, detail) AS (VALUES
    ('1 preferred_date',  'column',     'service_posts.preferred_date',   'blocks ALL job posting if missing'),
    ('2 is_suspended',    'column',     'users.is_suspended',             'blocks admin user management'),
    ('3 booking_events',  'constraint', 'booking_events_event_type_check','dispute + off-platform events silently dropped'),
    ('4 reviews',         'constraint', 'reviews_reviewee_type_check',    'employee reviews silently dropped'),
    ('5 geocode',         'column',     'service_posts.geocode_source',   'geocode backfill cannot run'),
    ('6 referrals',       'table',      'referrals',                      'referral claim at signup silently no-ops')
)
SELECT
    e.section,
    e.obj,
    CASE
      WHEN e.kind = 'column' AND EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name   = split_part(e.obj, '.', 1)
              AND c.column_name  = split_part(e.obj, '.', 2))       THEN 'OK — present'
      WHEN e.kind = 'table' AND EXISTS (
            SELECT 1 FROM information_schema.tables t
            WHERE t.table_schema = 'public' AND t.table_name = e.obj) THEN 'OK — present'
      WHEN e.kind = 'constraint' AND EXISTS (
            SELECT 1 FROM pg_constraint p WHERE p.conname = e.obj)   THEN 'EXISTS — check its allowed values below'
      ELSE '*** MISSING ***'
    END AS status,
    e.detail
FROM expected e
ORDER BY e.section;

-- And the two CHECK constraints' actual current contents:
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname IN ('booking_events_event_type_check', 'reviews_reviewee_type_check');


-- =====================================================================
-- STEP 1 — P0: service_posts.preferred_date
-- Source: docs/service_posts_preferred_date.sql
-- Without it, backend/app/api/service_posts.py:132 (create_service_post)
-- writes this key unconditionally, so EVERY job post fails — and the blanket
-- `except Exception` at :139 hides the cause behind a generic 400.
-- =====================================================================
ALTER TABLE public.service_posts
    ADD COLUMN IF NOT EXISTS preferred_date TIMESTAMPTZ;

COMMENT ON COLUMN public.service_posts.preferred_date IS
    'Client-preferred date/time for the job. Nullable — set at post-create or post-edit.';


-- =====================================================================
-- STEP 2 — P0: users.is_suspended
-- NO migration file for this existed anywhere in the repo. Written 2026-07-20.
-- backend/app/api/admin.py:60 selects it; :102 and :130 write it. Its own
-- module docstring says "Wave 6 migration should add it" — there is no Wave 6
-- file. docs/swingby_database_schema.md:44 flags it "unverified".
-- =====================================================================
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.is_suspended IS
    'Admin suspension flag. Set via /admin/suspend-user, cleared via /admin/unsuspend-user.';


-- =====================================================================
-- STEP 3 — booking_events.event_type CHECK
-- Source: docs/booking_events_event_type_extend.sql (CARD-02 repro'd this
-- against real Postgres). Without it, dispute and off-platform-payment events
-- are rejected — and disputes.py:124/:215 and payments_offplatform.py:93 all
-- swallow that failure with a log warning, so the audit trail for the two
-- highest-risk workflows silently empties.
-- =====================================================================
ALTER TABLE public.booking_events
  DROP CONSTRAINT IF EXISTS booking_events_event_type_check;

ALTER TABLE public.booking_events
  ADD CONSTRAINT booking_events_event_type_check
  CHECK (event_type IN (
    'dates_proposed', 'date_confirmed', 'en_route', 'arrived', 'started',
    'paused', 'resumed', 'completed', 'cancelled_event',
    'dispute_opened', 'dispute_resolved',
    'paid_offplatform'
  ));


-- =====================================================================
-- STEP 4 — reviews.reviewee_type CHECK + read policy
-- Source: docs/reviews_reviewee_type_extend_employee.sql
-- Without it, employee reviews are rejected and EmployeeProfileScreen shows
-- zero reviews forever — a feature that looks shipped and isn't.
-- =====================================================================
ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_reviewee_type_check;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_reviewee_type_check
  CHECK (reviewee_type IN ('business', 'client', 'employee'));

DROP POLICY IF EXISTS "reviews_select" ON reviews;
CREATE POLICY "reviews_select" ON reviews
    FOR SELECT
    TO authenticated
    USING (
        reviewee_type IN ('business', 'employee')
        OR reviewer_id = auth.uid()
        OR reviewee_id = auth.uid()
    );


-- =====================================================================
-- STEP 5 — geocoding provenance on service_posts
-- Source: docs/geocoding_columns.sql
-- Unblocks tools/backfill_geocode.py, which probes for geocode_source and
-- exits cleanly when it is absent — so the backfill has been a silent no-op.
-- =====================================================================
ALTER TABLE public.service_posts
    ADD COLUMN IF NOT EXISTS geocoded_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS geocode_source TEXT;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_posts_geocode_source_check') THEN
        ALTER TABLE public.service_posts
            ADD CONSTRAINT service_posts_geocode_source_check
            CHECK (geocode_source IS NULL OR geocode_source IN
                   ('places_autocomplete', 'geocoding_api', 'manual', 'failed'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS service_posts_needs_geocode_idx
    ON public.service_posts (created_at)
    WHERE lat IS NULL AND address IS NOT NULL;


-- =====================================================================
-- STEP 6 — referrals table
-- Source: docs/referrals_table.sql. Roadmap/DOMINOES.md D9.2 claims this is
-- already live; that claim has never been verified, and auth.py:268 swallows
-- the failure with a bare `except: pass` and NO logging, so if it is missing,
-- every referred signup no-ops with zero trace. STEP 0 settles it.
-- Run docs/referrals_table.sql itself if STEP 0 reports it MISSING — it is
-- not reproduced here to avoid drifting from the filed source of truth.
-- =====================================================================


-- =====================================================================
-- STEP 7 — RE-VERIFY. Re-run STEP 0. Every row should read OK, and both
-- CHECK definitions should list the extended value sets.
-- Then confirm the endpoints that were 500ing are alive:
--   GET /payments/mine   GET /disputes/mine   POST /service-posts/
-- =====================================================================
