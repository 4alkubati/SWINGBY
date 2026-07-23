-- Migration: drop the misspelled service_posts.preffered_date column.
--
-- Two date columns exist in prod: preffered_date (typo) and preferred_date
-- (correct, added by docs/service_posts_preferred_date.sql). Nothing in the
-- codebase references the typo — `grep -rn preffered_date` over backend/,
-- mobile/, web/, docs/ returns nothing — and it has never held a value
-- (0 non-null across all rows, verified 2026-07-22). It is a dead column.
--
-- Surfaced by the 2026-07-22 sweep (docs/AUDIT-2026-07-22.md #2).
-- Additive-safe: dropping an all-null, unreferenced column touches no data.
-- FILE ONLY — do not apply to prod; database-agent reviews and applies.

DO $$
DECLARE
    n bigint;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'service_posts'
          AND column_name = 'preffered_date'
    ) THEN
        -- Guard: refuse to drop if it somehow carries data, so this can never
        -- silently discard something a stray writer put there.
        EXECUTE 'SELECT count(*) FROM public.service_posts WHERE preffered_date IS NOT NULL'
            INTO n;
        IF n > 0 THEN
            RAISE EXCEPTION
                'preffered_date holds % non-null row(s); investigate before dropping', n;
        END IF;

        ALTER TABLE public.service_posts DROP COLUMN preffered_date;
        RAISE NOTICE 'Dropped service_posts.preffered_date (typo column).';
    ELSE
        RAISE NOTICE 'service_posts.preffered_date already gone — nothing to do.';
    END IF;
END $$;
