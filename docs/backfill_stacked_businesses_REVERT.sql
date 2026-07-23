-- backfill_stacked_businesses_REVERT.sql
-- Exact undo for docs/backfill_stacked_businesses.sql.
--
-- Restores the three pre-existing production rows to the values they held
-- before the 2026-07-23 backfill. Values below were read straight out of
-- production immediately before the change (SELECT ... FROM public.businesses)
-- and are reproduced verbatim, including the full float precision on
-- Greenland Lawncare's coordinates.
--
-- Nothing was ever deleted; the backfill only UPDATEd these three rows, so
-- this restores them completely.
--
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.

BEGIN;

-- Bob's Cleaning Co. -- was stacked on the shared downtown coordinate
UPDATE public.businesses SET
    business_name  = 'Bob''s Cleaning Co.',
    category       = 'Cleaning',
    lat            = 51.0447,
    lng            = -114.0719,
    address        = NULL,
    geocode_source = NULL,
    geocoded_at    = NULL
WHERE id = '84965d80-83b8-48ec-957d-d293d6d4cbf4';

-- Greenland Lawncare -- note the original higher-precision coordinates
UPDATE public.businesses SET
    business_name  = 'Greenland Lawncare',
    category       = 'Landscaping',
    lat            = 51.0447331,
    lng            = -114.0718831,
    address        = NULL,
    geocode_source = NULL,
    geocoded_at    = NULL
WHERE id = '3bae7e1d-6d69-43f7-adae-9f6662a5f61b';

-- Test Cleaning Co. -- original name AND original lowercase category 'cleaning'
UPDATE public.businesses SET
    business_name  = 'Test Cleaning Co.',
    category       = 'cleaning',
    lat            = 51.0447,
    lng            = -114.0719,
    address        = NULL,
    geocode_source = NULL,
    geocoded_at    = NULL
WHERE id = '6bcc5384-e420-48a2-9a26-cc7d34f9f6e1';

COMMIT;

-- Verify the revert landed:
-- SELECT id, business_name, category, lat, lng, address, geocode_source
-- FROM public.businesses
-- WHERE id IN ('84965d80-83b8-48ec-957d-d293d6d4cbf4',
--              '3bae7e1d-6d69-43f7-adae-9f6662a5f61b',
--              '6bcc5384-e420-48a2-9a26-cc7d34f9f6e1');
