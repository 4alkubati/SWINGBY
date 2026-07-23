-- =============================================================================
-- 20260720000000_s1_column_lockdown_and_unique_constraints.sql
--
-- FILED, PENDING APPLY — no live Supabase credentials were available in this
-- worktree (Supabase MCP was not connected), so this has NOT been run against
-- project ulnxapnsenzyddddldjt. Apply by hand in the Supabase SQL Editor (or
-- `supabase db push` once the CLI is linked), then update
-- docs/swingby_database_schema.md to drop the FILED note, same convention as
-- docs/referrals_table.sql / docs/service_posts_preferred_date.sql.
--
-- This is the first file in `supabase/migrations/` — going forward, new
-- schema/RLS changes should land here (ordered, timestamped, idempotent)
-- instead of as loose one-off files in `docs/`. The 13 pre-existing loose
-- files in `docs/*.sql` are left alone; reorganizing repo history is out of
-- scope for this fix.
--
-- Two independent fixes, safe to run together or separately (idempotent):
--   PART 1 — S1: column-level lockdown closing the direct-PostgREST PII leak
--   PART 2 — three UNIQUE constraints, guarded against pre-existing dupes
-- =============================================================================


-- =============================================================================
-- PART 1 — S1 fix: column-level SELECT lockdown for `authenticated`
-- =============================================================================
--
-- THE BUG (S1): `docs/rls_policies.sql` §4's `posts_select` policy —
--   using (status = 'open' or client_id = auth.uid())
-- — is a ROW filter. It correctly decides *which rows* an authenticated
-- non-owner may see (any open post), but it says nothing about *which
-- columns*. Supabase grants `authenticated` SELECT on every column of a
-- table by default; RLS policies only gate rows. So the full row — street
-- address included — is readable by anyone with a valid JWT and the anon
-- key, both of which are public (the anon key ships inside the Vite bundle
-- served from swingbyy.com; see web/pre-launch/src/lib/supabase.js /
-- web/launch/src/lib/supabase.js reading VITE_SUPABASE_ANON_KEY).
--
-- backend/app/privacy.py masks `address` (and strips `users.last_name`)
-- correctly in every API read path — but that masking is Python running in
-- front of the service_role client. It does nothing to stop someone from
-- skipping the API and calling PostgREST directly:
--   GET /rest/v1/service_posts?status=eq.open&select=*
--   Headers: apikey: <anon key>, Authorization: Bearer <their own valid JWT>
-- which returns the raw, unmasked address of every open post — reopening
-- the exact P0 that commit 403a2b4 was written to fix, just one layer down.
--
-- OPTIONS CONSIDERED:
--   (a) Column-level GRANT/REVOKE — chosen. `REVOKE SELECT (col) ... FROM
--       authenticated` is a role-level grant, independent of which RLS
--       policy matched the row, so it can't be bypassed by widening a
--       policy later. Per Postgres's own column-privilege semantics (and
--       Supabase's documented "Column Level Security" pattern), a bare
--       `SELECT *` / PostgREST `select=*` against a table where the caller
--       lacks privilege on one column does NOT error — it silently omits
--       that column. That's exactly the "survives a future select=*"
--       property this fix needs, and it needs zero application code changes
--       since service_role (used everywhere in backend/app/api/*.py — see
--       app/supabase_client.py) is a separate role that these REVOKEs do
--       not touch; the anon-key `supabase_auth` client is only ever used
--       for auth.sign_up/sign_in/refresh (backend/app/api/auth.py), never
--       for `.table()` reads, so no backend code path is affected.
--   (b) Split sensitive fields into their own table with a restrictive
--       policy — rejected for this pass: bookings.py already reads
--       `service_posts(title, address, lat, lng)` via a nested embed in four
--       places, and a split would require rewriting those embeds plus a
--       migration to move existing data. Heavier and riskier than (a) for
--       the same outcome; worth reconsidering only if more sensitive
--       columns accumulate on service_posts later.
--   (c) A security-barrier view exposed to `authenticated` instead of the
--       base table — rejected: would need its own INSTEAD OF triggers to
--       stay writable for `posts_insert`/`posts_update` (the direct-client
--       write path that exists in the policy file, even though no current
--       frontend code uses it — see audit below), and would need adding to
--       PostgREST's exposed-schema config. More moving parts than (a) for
--       an equivalent result.
--
-- NOTE: `lat`/`lng` are deliberately NOT revoked here. CLAUDE.md's
-- privacy.py docstring is explicit that "approximate location" is meant to
-- be visible pre-acceptance (map pins in geo-browse need it), so precise
-- coordinates are an intentional design choice, not a masking gap. Flagged
-- as a separate, out-of-scope observation in the S1 report: geocoded
-- lat/lng from a real address (see app/services/geocoding.py) can be
-- rooftop-precision, which arguably approaches street-address precision —
-- worth a follow-up decision by whoever owns the privacy policy, not fixed
-- here.
--
-- Idempotent: REVOKE on a privilege the role doesn't hold is a no-op in
-- Postgres (no error), so this is safe to run any number of times and safe
-- if it lands twice (e.g. also appended independently to
-- docs/rls_policies.sql, which it is, verbatim).

revoke select (address) on service_posts from authenticated;

-- =============================================================================
-- PART 1b — same shape, found during the "audit every other policy" pass
-- =============================================================================
-- `businesses_select_authenticated` (docs/rls_policies.sql §2) is
-- `using (true)` for `to authenticated` — i.e. every authenticated user can
-- read the FULL businesses row, not just the public discovery fields
-- (business_name, category, lat/lng, service_radius_km, avg_rating,
-- review_count, license_status). That row also carries:
--   - stripe_customer_id, subscription_id  — Stripe object identifiers;
--     financial-system correlation risk if leaked, no legitimate reason a
--     browsing client/business needs another business's billing IDs.
--   - subscription_current_period_end      — billing-cycle timing metadata.
--   - license_number                       — the business's actual license
--     number (not just verified/pending status), sensitive identity data.
-- None of these are read by any browsing/discovery UI — they're written and
-- read exclusively by backend/app/api/subscriptions.py and payments_stripe.py
-- via the service_role client, which this REVOKE does not affect. Not
-- payment *logic* (no computation, no escrow/release code touched) — this is
-- a database grant, left in scope per this task's mandate to fix PII/
-- financial leaks found in the RLS audit.
revoke select (
    license_number,
    stripe_customer_id,
    subscription_id,
    subscription_current_period_end
) on businesses from authenticated;

-- Rest of the audit (docs/rls_policies.sql §1, 3, 5, 6, 7, 8, 9, 10): every
-- other policy scopes rows to the caller's own participant relationship
-- (client_id/business_id/employee_id/owner_id = auth.uid(), or an explicit
-- reviewee_type='business' public-reviews carve-out that matches its stated
-- intent) and doesn't expose row content beyond what that relationship
-- already implies. No further column-level issue found.


-- =============================================================================
-- PART 2 — UNIQUE constraints
-- =============================================================================
-- Constraint names below match Postgres's own default auto-generated name
-- for `ALTER TABLE t ADD UNIQUE (cols)` (i.e. `<table>_<col(s)>_key`) on
-- purpose: a sibling agent implementing the payment spec §8 version of these
-- same constraints is likely to land on the same auto-generated name if they
-- don't hand-pick one, which makes the guard below a no-op the second time
-- regardless of which migration runs first. If they DO hand-pick a different
-- name, both constraints will coexist harmlessly (redundant unique index,
-- not a conflict) — the only real failure mode is pre-existing duplicate
-- data, checked and reported below.
--
-- IMPORTANT — this was NOT verified against live data (no DB access in this
-- worktree). Each block below raises a NOTICE and SKIPS the constraint if it
-- finds violating rows, rather than letting the whole migration abort. A
-- human with live DB access must run the three pre-flight SELECTs (also
-- reproduced in backend/tests/test_migrations.py's docstring and the S1
-- report) and resolve any real duplicates before this constraint can go on
-- for real.

-- 2a. businesses(owner_id) — "one business per owner" is stated as intent
-- in docs/swingby_database_schema.md §2 but explicitly flagged there as
-- "not a DB unique constraint as far as reconstructed." Highest risk of the
-- three: seed/import scripts (docs/wave-10-seed-businesses.sql) or early
-- manual test-data creation are plausible sources of a pre-existing
-- duplicate owner_id in production.
do $$
begin
    if exists (
        select 1 from businesses group by owner_id having count(*) > 1
    ) then
        raise notice 'S1 migration: businesses.owner_id has duplicate rows — skipping UNIQUE(owner_id). Resolve duplicates, then rerun.';
    elsif not exists (
        select 1 from pg_constraint where conname = 'businesses_owner_id_key'
    ) then
        alter table businesses add constraint businesses_owner_id_key unique (owner_id);
    end if;
end $$;

-- 2b. interests(post_id, business_id) — "a business can only quote a given
-- post once" — app-level dup check exists in backend/app/api/interests.py
-- but isn't backed by a DB constraint.
do $$
begin
    if exists (
        select 1 from interests group by post_id, business_id having count(*) > 1
    ) then
        raise notice 'S1 migration: interests(post_id, business_id) has duplicate rows — skipping UNIQUE constraint. Resolve duplicates, then rerun.';
    elsif not exists (
        select 1 from pg_constraint where conname = 'interests_post_id_business_id_key'
    ) then
        alter table interests add constraint interests_post_id_business_id_key unique (post_id, business_id);
    end if;
end $$;

-- 2c. bookings(post_id) — post_id is nullable (direct/geo-browse bookings
-- have no post), and Postgres UNIQUE constraints treat NULLs as distinct
-- from one another, so any number of NULL post_id rows co-exist fine; only
-- non-null duplicates would block this.
do $$
begin
    if exists (
        select 1 from bookings where post_id is not null
        group by post_id having count(*) > 1
    ) then
        raise notice 'S1 migration: bookings.post_id has duplicate non-null rows — skipping UNIQUE(post_id). Resolve duplicates, then rerun.';
    elsif not exists (
        select 1 from pg_constraint where conname = 'bookings_post_id_key'
    ) then
        alter table bookings add constraint bookings_post_id_key unique (post_id);
    end if;
end $$;
