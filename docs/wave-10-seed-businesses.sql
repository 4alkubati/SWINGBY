-- ============================================================================
-- Wave 10 — Seed Businesses (one per category)
-- Purpose: populate the browse/nearby views for visual testing
-- Region: Calgary, AB, Canada (base: 51.04, -114.06)
--
-- > TODO (HUMAN): apply this seed via Supabase SQL editor or MCP when ready
-- > to populate browse views. Make sure at least one user with role='business_owner'
-- > exists first (the seed uses the first business_owner in the table as fallback).
-- ============================================================================

DO $$
DECLARE
  v_owner_id UUID;
BEGIN
  -- Pick any existing business_owner, or abort gracefully if none exists
  SELECT id INTO v_owner_id
  FROM public.users
  WHERE role = 'business_owner'
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE 'No business_owner user found. Create one first then re-run this seed.';
    RETURN;
  END IF;

  -- ── 1. House Cleaning ─────────────────────────────────────────────────────
  INSERT INTO public.businesses (
    owner_id, business_name, category, description,
    lat, lng, service_radius_km,
    avg_rating, review_count, license_status
  )
  SELECT
    v_owner_id,
    'Beltline Sparkle Cleaning',
    'Cleaning',
    'Eco-friendly residential and commercial cleaning. Deep cleans, move-in/out, recurring weekly.',
    51.0385, -114.0715, 10,
    4.9, 34, 'verified'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.businesses WHERE business_name = 'Beltline Sparkle Cleaning'
  );

  -- ── 2. Handyman ───────────────────────────────────────────────────────────
  INSERT INTO public.businesses (
    owner_id, business_name, category, description,
    lat, lng, service_radius_km,
    avg_rating, review_count, license_status
  )
  SELECT
    v_owner_id,
    'Mission Handyman Co.',
    'Handyman',
    'Furniture assembly, drywall, caulking, small repairs. Fast turnaround, fair pricing.',
    51.0452, -114.0892, 12,
    4.8, 22, 'verified'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.businesses WHERE business_name = 'Mission Handyman Co.'
  );

  -- ── 3. Dog Walking ────────────────────────────────────────────────────────
  INSERT INTO public.businesses (
    owner_id, business_name, category, description,
    lat, lng, service_radius_km,
    avg_rating, review_count, license_status
  )
  SELECT
    v_owner_id,
    'River Park Paws',
    'Dog Walking',
    'Daily walks, group hikes, and drop-in visits. GPS-tracked walks, photo updates.',
    51.0286, -114.0931, 8,
    5.0, 18, 'verified'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.businesses WHERE business_name = 'River Park Paws'
  );

  -- ── 4. Personal Training ──────────────────────────────────────────────────
  INSERT INTO public.businesses (
    owner_id, business_name, category, description,
    lat, lng, service_radius_km,
    avg_rating, review_count, license_status
  )
  SELECT
    v_owner_id,
    'Kensington Fit Studio',
    'Personal Training',
    'In-home personal training. Strength, HIIT, mobility. Certified trainer with 7 years experience.',
    51.0542, -114.0976, 15,
    4.7, 29, 'verified'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.businesses WHERE business_name = 'Kensington Fit Studio'
  );

  -- ── 5. Lawn Care ──────────────────────────────────────────────────────────
  INSERT INTO public.businesses (
    owner_id, business_name, category, description,
    lat, lng, service_radius_km,
    avg_rating, review_count, license_status
  )
  SELECT
    v_owner_id,
    'Inglewood Lawn & Garden',
    'Lawn Care',
    'Mowing, edging, aeration, fertilization, spring/fall cleanup. Weekly and bi-weekly plans.',
    51.0432, -114.0334, 14,
    4.8, 40, 'verified'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.businesses WHERE business_name = 'Inglewood Lawn & Garden'
  );

  -- ── 6. Snow Removal ───────────────────────────────────────────────────────
  INSERT INTO public.businesses (
    owner_id, business_name, category, description,
    lat, lng, service_radius_km,
    avg_rating, review_count, license_status
  )
  SELECT
    v_owner_id,
    'Calgary Clear Paths',
    'Snow Removal',
    'Driveway, walkway, and commercial lot snow clearing. Season contracts available.',
    51.0623, -114.0584, 15,
    4.6, 15, 'verified'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.businesses WHERE business_name = 'Calgary Clear Paths'
  );

  -- ── 7. Electrical ─────────────────────────────────────────────────────────
  INSERT INTO public.businesses (
    owner_id, business_name, category, description,
    lat, lng, service_radius_km,
    avg_rating, review_count, license_status
  )
  SELECT
    v_owner_id,
    'Ramsay Electric Services',
    'Electrical',
    'Licensed electrician. Panel upgrades, outlet installation, EV charger wiring, troubleshooting.',
    51.0355, -114.0456, 20,
    4.9, 31, 'verified'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.businesses WHERE business_name = 'Ramsay Electric Services'
  );

  -- ── 8. Plumbing ───────────────────────────────────────────────────────────
  INSERT INTO public.businesses (
    owner_id, business_name, category, description,
    lat, lng, service_radius_km,
    avg_rating, review_count, license_status
  )
  SELECT
    v_owner_id,
    'Hillhurst Plumbing Co.',
    'Plumbing',
    'Leaks, drain cleaning, fixture install, water heater replacement. Same-day availability.',
    51.0558, -114.0842, 18,
    4.7, 27, 'verified'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.businesses WHERE business_name = 'Hillhurst Plumbing Co.'
  );

  -- ── 9. Moving ─────────────────────────────────────────────────────────────
  INSERT INTO public.businesses (
    owner_id, business_name, category, description,
    lat, lng, service_radius_km,
    avg_rating, review_count, license_status
  )
  SELECT
    v_owner_id,
    'YYC Movers Express',
    'Moving',
    'Local and long-distance moving. 2-person crew, 16-ft truck. Packing service available.',
    51.0178, -114.0563, 25,
    4.8, 38, 'verified'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.businesses WHERE business_name = 'YYC Movers Express'
  );

  -- ── 10. Painting ──────────────────────────────────────────────────────────
  INSERT INTO public.businesses (
    owner_id, business_name, category, description,
    lat, lng, service_radius_km,
    avg_rating, review_count, license_status
  )
  SELECT
    v_owner_id,
    'Altadore Painting Pros',
    'Painting',
    'Interior and exterior painting. Colour consultation included. Prep, prime, and paint.',
    51.0289, -114.1021, 12,
    4.9, 24, 'verified'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.businesses WHERE business_name = 'Altadore Painting Pros'
  );

  RAISE NOTICE 'Seed complete — up to 10 businesses inserted (skipped any that already exist).';
END $$;


-- ============================================================================
-- ROLLBACK (uncomment to undo)
-- ============================================================================
-- DELETE FROM public.businesses
-- WHERE business_name IN (
--   'Beltline Sparkle Cleaning',
--   'Mission Handyman Co.',
--   'River Park Paws',
--   'Kensington Fit Studio',
--   'Inglewood Lawn & Garden',
--   'Calgary Clear Paths',
--   'Ramsay Electric Services',
--   'Hillhurst Plumbing Co.',
--   'YYC Movers Express',
--   'Altadore Painting Pros'
-- );
