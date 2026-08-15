-- 20260815000000_revoke_direct_postgrest_access.sql
--
-- SWEEP 2026-08-15, finding F1 — and the reason the S1 lockdown it replaces
-- never worked.
--
-- =============================================================================
-- WHY THE EXISTING COLUMN-LEVEL REVOKES ARE NO-OPS
-- =============================================================================
-- 20260720000000_s1_column_lockdown_and_unique_constraints.sql (and the verbatim
-- copies at docs/rls_policies.sql:85-90 and :177) close the PII leak like this:
--
--     revoke select (address) on service_posts from authenticated;
--
-- That statement succeeds, reports REVOKE, and changes nothing. Postgres treats
-- table-level and column-level privileges as a SUM, and a column-level REVOKE
-- cannot subtract from a table-level GRANT. Supabase's stock bootstrap contains
--
--     grant all on all tables in schema public to anon, authenticated;
--
-- so `authenticated` holds table-wide SELECT/INSERT/UPDATE/DELETE and keeps it.
--
-- Verified empirically on postgres:16 before writing this file:
--
--     grant all on all tables in schema public to authenticated;
--     revoke select (address) on public.t from authenticated;
--     set role authenticated; select address from public.t;
--       -> '123 Main St'          -- the REVOKE did nothing
--     revoke update (role_col) on public.t from authenticated;
--     update public.t set role_col='admin';
--       -> UPDATE 1               -- likewise
--
--   and the shape that DOES work:
--     revoke select, update on public.t from authenticated;
--     grant select (id, name) on public.t to authenticated;
--     set role authenticated; select address from public.t;
--       -> ERROR: permission denied for table t
--
-- So the S1 street-address leak is open regardless of whether that migration was
-- ever applied, and 20260720000000's line 61-69 rationale ("a role-level grant,
-- independent of which RLS policy matched the row") is half right: it IS
-- independent of RLS, and it is also inert against the table-level grant.
--
-- =============================================================================
-- WHAT THIS DOES INSTEAD, AND WHY IT IS SAFE
-- =============================================================================
-- Rather than enumerate safe columns on six tables, revoke the table privileges
-- outright. NOTHING legitimate uses them:
--
--   * `grep -rnE "\.from\(['\"]" web/*/src mobile/src` returns ZERO hits. No
--     frontend has ever read or written a table through PostgREST.
--   * supabase-js in web/launch + web/pre-launch is used only for `supabase.auth.*`
--     (session, OAuth, password reset) — see web/launch/src/lib/auth.js.
--   * No realtime subscriptions (`.channel(` / `postgres_changes`: zero hits), so
--     nothing needs SELECT to receive changes.
--   * No client-side `.storage` use and no `.rpc(` calls anywhere.
--   * The backend reads and writes exclusively through the service_role client
--     (app/supabase_client.py); `supabase_auth`, the anon-key client, is used
--     only for auth.* and never calls `.table()`.
--
-- service_role and postgres are deliberately untouched, so every backend path
-- is unaffected. The `storage` schema is untouched, so the public-read
-- `job-photos` bucket keeps working.
--
-- The RLS policies in docs/rls_policies.sql are deliberately LEFT IN PLACE as
-- defence in depth: if a future migration re-grants table access, the row
-- policies still gate rows. This file removes the grant those policies were the
-- only guard on.
--
-- =============================================================================
-- WHAT WAS ACTUALLY EXPLOITABLE BEFORE THIS
-- =============================================================================
-- `users_update_own` (docs/rls_policies.sql:38-40) is
--   for update using (auth.uid() = id)
-- with no column list, and deps.py:41-47 loads that row with select("*") and
-- returns it as `current_user`. So, with the anon key that ships in the public
-- Vite bundle plus their own valid JWT:
--
--   PATCH /rest/v1/users?id=eq.<own-id>   {"role":"admin"}
--       -> admin.py:45 `current_user.get("role") != "admin"` now passes.
--   PATCH .. {"is_suspended": false}      -> undo a moderation ban (deps.py:55).
--   PATCH .. {"deleted_at": null}         -> undo a soft delete (deps.py:53).
--   PATCH .. {"sessions_valid_after": null}
--       -> erase the D7.4 revocation watermark (deps.py:71-74), which is what
--          makes a detected refresh-token replay stick.
--
-- Same shape elsewhere: `businesses_update_own` (:67-69) over a row carrying
-- `license_status` — the manual verification gate admin.py:452 sets — and
-- `avg_rating`; `interests_update` (:205-210) lets the CLIENT rewrite any
-- column of a quote on their own post, and interests.py:353 charges
-- `escrow.to_cents(interest["quoted_price"] or post["budget"])`, so a quote
-- rewritten to 0.01 and then accepted is a priced-to-zero booking.

begin;

-- ── 1. Remove the standing table grants ────────────────────────────────────
-- Covers every existing table in `public`, which is every table these findings
-- touch and every one added since. Idempotent: revoking an unheld privilege is
-- a no-op, not an error.
revoke all privileges on all tables in schema public from anon, authenticated;

-- Sequences and functions ride the same default bootstrap grant. Nothing
-- client-side calls an RPC (verified: zero `.rpc(` hits in web/ and mobile/),
-- and a nextval() reachable by anon has no legitimate caller either.
revoke all privileges on all sequences in schema public from anon, authenticated;
revoke all privileges on all functions in schema public from anon, authenticated;

-- ── 2. Stop the next table from re-granting itself ─────────────────────────
-- Supabase's bootstrap sets ALTER DEFAULT PRIVILEGES so that every future table
-- in `public` is granted to anon/authenticated. Without this block, the very
-- next `create table` silently reopens everything above.
--
-- Default privileges are per-grantor, so this must run as the role that owns
-- the migration connection (postgres / supabase_admin), which is the role the
-- Supabase SQL editor and `supabase db push` both use.
alter default privileges in schema public
    revoke all privileges on tables from anon, authenticated;
alter default privileges in schema public
    revoke all privileges on sequences from anon, authenticated;
alter default privileges in schema public
    revoke all privileges on functions from anon, authenticated;

-- ── 3. Keep `usage` on the schema itself ───────────────────────────────────
-- Not revoked on purpose. PostgREST needs schema USAGE to answer at all, and
-- with zero table privileges the answer is a clean 401/permission-denied rather
-- than a confusing schema-cache error. Revoking USAGE as well would work but
-- changes the error surface for no additional protection.

commit;

-- ── Verification, after applying ───────────────────────────────────────────
-- Expect ZERO rows from both:
--
--   select grantee, table_name, privilege_type
--     from information_schema.role_table_grants
--    where grantee in ('anon','authenticated') and table_schema='public';
--
--   select defaclrole::regrole, defaclobjtype, defaclacl
--     from pg_default_acl
--    where defaclnamespace = 'public'::regnamespace
--      and array_to_string(defaclacl, ',') ~ '(anon|authenticated)';
