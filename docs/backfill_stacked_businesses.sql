-- backfill_stacked_businesses.sql
-- Spreads the three real (non-seeded) businesses off their shared pin.
--
-- BEFORE: all three sat on 51.0447,-114.0719 -- the same downtown point, so
-- the map showed one marker where there should have been three. They were
-- created through the broken signup path (see
-- docs/businesses_address_and_geocode.sql) which stored no address, so there
-- was nothing to geocode them from until the `address` column existed.
--
-- Each row gets a plausible, distinct Calgary address in a neighbourhood no
-- other business already occupies, so the demo map reads like real coverage
-- across the city rather than a pile of pins downtown.
--
-- geocode_source = 'manual' is deliberate and honest: these coordinates were
-- set by hand to match the assigned addresses, NOT returned by the Google
-- Geocoding API. Marking them 'geocoding_api' would falsely claim provenance.
-- 'manual' is one of the four values allowed by the CHECK constraint.
--
-- 'Test Cleaning Co.' is also RENAMED -- an investor should not see the word
-- "Test" on the map. Its category is normalised from lowercase 'cleaning' to
-- 'Cleaning' to match every other row (the nearby/list endpoints match with
-- ilike so the old value worked, but it displayed inconsistently).
--
-- Reverting: docs/backfill_stacked_businesses_REVERT.sql restores all three
-- rows exactly, including the original name, the lowercase category, and
-- Greenland's higher-precision coordinates. Nothing here deletes anything.

BEGIN;

-- Bob's Cleaning Co. -> Marlborough (NE Calgary), previously unrepresented
UPDATE public.businesses SET
    address        = '1240 36 St NE, Calgary, AB',
    lat            = 51.0565,
    lng            = -113.9752,
    geocode_source = 'manual',
    geocoded_at    = now()
WHERE id = '84965d80-83b8-48ec-957d-d293d6d4cbf4';

-- Greenland Lawncare -> Bowness (NW Calgary); 50 km radius suits a landscaper
UPDATE public.businesses SET
    address        = '6432 Bowness Rd NW, Calgary, AB',
    lat            = 51.0886,
    lng            = -114.1934,
    geocode_source = 'manual',
    geocoded_at    = now()
WHERE id = '3bae7e1d-6d69-43f7-adae-9f6662a5f61b';

-- Test Cleaning Co. -> renamed + moved to Douglasdale (SE Calgary)
UPDATE public.businesses SET
    business_name  = 'Douglas Glen Cleaning Co.',
    category       = 'Cleaning',
    address        = '11566 Douglas Woods Dr SE, Calgary, AB',
    lat            = 50.9412,
    lng            = -113.9847,
    geocode_source = 'manual',
    geocoded_at    = now()
WHERE id = '6bcc5384-e420-48a2-9a26-cc7d34f9f6e1';

COMMIT;
