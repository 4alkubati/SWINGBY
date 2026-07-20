-- Migration: geocoding provenance columns for service_posts.
-- Written 2026-07-19 for FEATURE-01 (route optimization) card RO-0.
--
-- Context: `lat`/`lng` already exist on service_posts and the backend already
-- reads and writes them (backend/app/api/service_posts.py). They are NULL in
-- practice because the only writer was a mobile Google Places branch gated on
-- EXPO_PUBLIC_GOOGLE_PLACES_KEY (mobile/src/screens/client/PostJobScreen.js:37,303),
-- an env var that was never set until 2026-07-19. Every job posted before then
-- has a NULL coordinate pair.
--
-- This migration adds NO coordinate columns. It adds provenance, so the
-- backfill in tools/backfill_geocode.py can distinguish "never attempted"
-- (NULL) from "attempted and unresolvable" ('failed') and skip the latter
-- instead of burning Geocoding API quota on the same bad address every run.
--
-- Additive, all nullable, no backfill required by the migration itself.
-- Nothing in the request path writes these columns — see the docstring on
-- app/services/geocoding.py::resolve_coordinates for why that is deliberate.
-- FILE ONLY -- do not apply to prod; database-agent reviews and applies.
--
-- NOTE: `businesses` deliberately gets no equivalent columns. That table
-- stores no address (BusinessCreate has lat/lng only), so there is nothing to
-- geocode from and no provenance to record. See the comment at
-- backend/app/api/businesses.py in the create handler.

ALTER TABLE public.service_posts
    ADD COLUMN IF NOT EXISTS geocoded_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS geocode_source TEXT
        CHECK (geocode_source IS NULL OR geocode_source IN ('places_autocomplete', 'geocoding_api', 'manual', 'failed'));

COMMENT ON COLUMN public.service_posts.geocode_source IS 'How lat/lng were obtained. ''failed'' means geocoding was attempted and the address could not be resolved - do not retry on every request; the backfill may retry these on a slow cadence. NULL means never attempted.';

COMMENT ON COLUMN public.service_posts.geocoded_at IS 'When the last geocoding attempt ran, successful or not. Paired with geocode_source.';

-- Partial index: the backfill's only query is "rows with an address but no
-- coordinates". The table is tiny today (28 rows), but the index costs nothing
-- and makes the backfill a no-op scan once it has caught up.
CREATE INDEX IF NOT EXISTS service_posts_needs_geocode_idx
    ON public.service_posts (created_at)
    WHERE lat IS NULL AND address IS NOT NULL;

-- No RLS changes: service_posts already has policies (docs/rls_policies.sql)
-- and these columns inherit them. All writes go through service_role, which
-- bypasses RLS, per the house rule.
