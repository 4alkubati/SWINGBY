-- CARD-06 — clear 2 of 3 open Supabase security advisors (project ulnxapnsenzyddddldjt).
-- The third advisor (HIBP leaked-password protection) is a dashboard-only Auth
-- setting with no SQL surface — see docs/LAUNCH_CHECKLIST.md / CARD-06 report
-- for the exact click-path; NOT covered by this file.
--
-- Rollback notes:
--   1) search_path pin: re-running CREATE OR REPLACE without `SET search_path`
--      reverts to the mutable-search_path state (not recommended — just don't).
--   2) storage policy: to restore the old (flagged) behavior, re-create the
--      dropped policy:
--        CREATE POLICY "Public read job photos" ON storage.objects
--          FOR SELECT TO public USING (bucket_id = 'job-photos');
--
-- Verified via Supabase advisors (get_advisors, type=security) before writing
-- this file — exact WARN entries:
--   - function_search_path_mutable: public.update_disputes_updated_at
--   - public_bucket_allows_listing: job-photos bucket, policy "Public read job photos"
--   - auth_leaked_password_protection (not addressed here — dashboard only)

-- =====================================================================
-- Fix 1: pin search_path on the disputes updated_at trigger function.
-- =====================================================================
-- Current live definition (confirmed via execute_sql, pg_get_functiondef):
--   CREATE OR REPLACE FUNCTION public.update_disputes_updated_at()
--    RETURNS trigger LANGUAGE plpgsql AS $function$
--    BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $function$
-- Body only touches NEW.updated_at (record field, not schema-resolved) and
-- calls NOW() (pg_catalog, always resolvable regardless of search_path), so
-- an empty search_path is safe and closes the mutable-search_path warning.
CREATE OR REPLACE FUNCTION public.update_disputes_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- =====================================================================
-- Fix 2: stop job-photos bucket from being listable via the storage API.
-- =====================================================================
-- storage.buckets.public = true for job-photos (confirmed live), which means
-- individual object downloads already work through the public URL endpoint
-- (/storage/v1/object/public/job-photos/...), independent of RLS — see
-- backend/app/api/uploads.py's use of `storage.from_(BUCKET).get_public_url()`.
-- The broad `USING (bucket_id = 'job-photos')` SELECT policy below is what
-- additionally lets any client enumerate/list every object in the bucket via
-- the storage API's list() call — that's the flagged risk, and it isn't
-- needed for the public-URL access path the app actually uses.
DROP POLICY IF EXISTS "Public read job photos" ON storage.objects;

-- Note: the existing "Owners can delete job photos" DELETE policy on
-- storage.objects is untouched by this migration — deletion scoping was not
-- flagged by the advisor and is out of scope for CARD-06.
