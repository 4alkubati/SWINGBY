-- businesses_address_and_geocode.sql
-- Adds the service address + geocoding provenance columns to public.businesses.
--
-- WHY (the bug this closes):
-- A business owner signing up types a service address in
-- mobile/src/screens/onboarding/BusinessSetupScreen.js. That screen renders a
-- Google Places autocomplete ONLY when EXPO_PUBLIC_GOOGLE_PLACES_KEY is set and
-- the platform is not web; that branch is the only thing that ever set lat/lng.
-- With the key absent (its state today) the screen falls back to a plain text
-- input which captured the address into local state and then THREW IT AWAY —
-- the POST /businesses/ payload carried no address and no coordinates. The row
-- was created with NULL lat/lng, and GET /businesses/nearby skips rows without
-- coordinates (backend/app/api/businesses.py), so the business never appeared
-- on the map. Silent failure: signup "succeeded", the pin never existed.
--
-- The server-side fallback in app/services/geocoding.py::geocode_address has
-- worked since RO-0, but businesses could not use it: with no address column
-- there was nothing to geocode from. docs/geocoding_columns.sql says as much
-- ("`businesses` deliberately gets no equivalent columns"). This migration
-- supersedes that note — the address column is exactly what unblocks both the
-- request-path fallback and any future backfill of coordinate-less rows.
--
-- Mirrors the service_posts shape (docs/geocoding_columns.sql) so both tables
-- carry identical provenance semantics and one backfill idiom covers both.
--
-- Additive, all nullable, no data rewritten. Idempotent: safe to re-run.

ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS address        TEXT,
    ADD COLUMN IF NOT EXISTS geocoded_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS geocode_source TEXT
        CHECK (geocode_source IS NULL OR geocode_source IN ('places_autocomplete', 'geocoding_api', 'manual', 'failed'));

COMMENT ON COLUMN public.businesses.address IS 'Free-text service address as typed or picked by the owner. The source of truth for server-side geocoding when the client sends no coordinates.';

COMMENT ON COLUMN public.businesses.geocode_source IS 'How lat/lng were obtained. ''places_autocomplete'' = client-resolved (most precise, wins over re-geocoding). ''geocoding_api'' = server fallback. ''failed'' means geocoding was attempted and the address could not be resolved - do not retry on every request. NULL means never attempted.';

COMMENT ON COLUMN public.businesses.geocoded_at IS 'When the last geocoding attempt ran, successful or not. Paired with geocode_source.';

-- Partial index for the "has an address but no pin" query a backfill runs.
-- The table is tiny (18 rows today); the index costs nothing and keeps the
-- backfill a no-op scan once it has caught up. Same idiom as
-- service_posts_needs_geocode_idx.
CREATE INDEX IF NOT EXISTS businesses_needs_geocode_idx
    ON public.businesses (created_at)
    WHERE lat IS NULL AND address IS NOT NULL;

-- No RLS changes: businesses already has policies (docs/rls_policies.sql) and
-- these columns inherit them. All writes go through service_role, which
-- bypasses RLS, per the house rule.
