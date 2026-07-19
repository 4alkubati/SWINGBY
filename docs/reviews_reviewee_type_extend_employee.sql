-- MOBILE-PRODUCT card, Goal 2 (audit M3 — employee-reviews placeholder).
-- NOT YET APPLIED to the live project — filed for Kira/database-agent to run
-- via Supabase MCP `apply_migration` or the SQL Editor once approved.
--
-- Extends reviews.reviewee_type CHECK to allow 'employee' alongside the
-- existing 'business' | 'client'.
--
-- Without this, POST /reviews/ (backend/app/api/reviews.py::create_review)
-- silently fails to write the per-employee review row it now attempts when
-- a completed booking has an assigned employee_id — the insert hits this
-- CHECK, raises, and is caught + logged (never surfaced to the caller, so
-- the primary business-targeted review still succeeds). Until this migration
-- lands, GET /reviews/employee/{user_id} and the EmployeeProfileScreen
-- review list stay correctly empty — not a bug, just no rows exist yet.
--
-- Documented today in docs/swingby_database_schema.md §10 and flagged in
-- backend/app/api/employees.py::employee_profile docstring ("reviews.
-- reviewee_type CHECK currently allows only ('client','business')").
--
-- Exact constraint name not confirmed against the live DB (no CREATE TABLE
-- for `reviews` found in this repo — table predates the migrations kept
-- here). `reviews_reviewee_type_check` is Postgres's default auto-generated
-- name for an inline, unnamed CHECK on this column; confirm with
-- `\d reviews` (or the Supabase advisors/schema view) before applying, and
-- adjust the constraint name below if it differs.

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_reviewee_type_check;

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_reviewee_type_check
  CHECK (reviewee_type IN ('business', 'client', 'employee'));

-- RLS follow-on (docs/rls_policies.sql §9, policy "reviews_select"): today
-- only `reviewee_type = 'business'` rows are publicly SELECT-able; 'client'
-- and 'employee' rows are visible only to the reviewer or reviewee. The
-- employee trust card (GET /employees/{id}/profile, D2.1) is documented as
-- a "public trust card" — same intent as a business profile — so employee
-- reviews should be public-readable too, same as business reviews.
--
-- Backend reads through the service-role key today (bypasses RLS entirely,
-- per CLAUDE.md — "service_role key backend-only"), so this gap does NOT
-- block the feature built in this card. It matters only if/when a client
-- ever queries Supabase directly with the anon/authenticated key. Included
-- here for completeness so RLS doesn't silently drift from the public-read
-- intent; drop this statement if that's not desired.
DROP POLICY IF EXISTS "reviews_select" ON reviews;

CREATE POLICY "reviews_select" ON reviews
    FOR SELECT
    TO authenticated
    USING (
        reviewee_type IN ('business', 'employee')  -- public ratings/trust cards
        OR reviewer_id = auth.uid()                -- own reviews
        OR reviewee_id = auth.uid()                -- reviews about you
    );
