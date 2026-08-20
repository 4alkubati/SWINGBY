-- 20260819130000_revoke_connect_columns.sql
--
-- SB-0042 — narrow what `authenticated` and `anon` can read from `businesses`.
--
-- `businesses_select_authenticated` is `using (true)`, so every signed-in user
-- can read every business row. Column grants are the only thing that narrows
-- it, and the row carries Stripe Connect ids, the full subscription shape, and
-- the licence number.
--
--
-- WHY THE OBVIOUS VERSION OF THIS MIGRATION DOES NOTHING
-- ------------------------------------------------------
-- Two earlier attempts used `revoke select (col, col, ...) on businesses from
-- authenticated`. Both were no-ops, and it took reading the live grant table to
-- see why:
--
--     select grantee, privilege_type from information_schema.role_table_grants
--     where table_name = 'businesses';
--     -- authenticated | SELECT      <-- TABLE-level
--     -- anon          | SELECT      <-- TABLE-level
--
-- In Postgres, a column-level REVOKE against a role that holds the TABLE-level
-- privilege changes nothing: the table grant continues to cover every column,
-- including ones added later. So:
--
--   * `20260720000000_s1_column_lockdown_and_unique_constraints` was ineffective
--     by construction — it would have protected nothing on the day it was
--     written. It was also never applied, which is how nobody found out.
--   * The first version of THIS migration ran successfully against production
--     and also protected nothing. `{"success": true}` meant the statements were
--     valid, not that the columns were private.
--
-- The only thing that narrows a table grant is removing it and granting back
-- the columns you actually want readable. Deny-by-default, so a column added
-- next month is private until someone says otherwise — which is the property
-- the column-REVOKE approach never had, even in principle.
--
--
-- WHY THIS IS SAFE
-- ----------------
-- No client reads this table directly. The Supabase JS client is used for AUTH
-- only in both web apps (login, auth callback, account settings) — nothing
-- anywhere calls `.from('businesses')`. The backend reads it through the
-- service_role client, which bypasses grants entirely. And the public discovery
-- columns are granted straight back, so even a direct reader nobody remembered
-- keeps working for everything a client legitimately needs.

revoke select on public.businesses from authenticated;
revoke select on public.businesses from anon;

-- The public shape of a business: enough to render a card, a profile or a map
-- pin. Anything absent from this list is private, including every column added
-- after today.
grant select (
    id,
    owner_id,
    business_name,
    category,
    custom_category,
    description,
    license_status,
    lat,
    lng,
    service_radius_km,
    avg_rating,
    review_count,
    address,
    logo_url,
    created_at
) on public.businesses to authenticated;

grant select (
    id,
    owner_id,
    business_name,
    category,
    custom_category,
    description,
    license_status,
    lat,
    lng,
    service_radius_km,
    avg_rating,
    review_count,
    address,
    logo_url,
    created_at
) on public.businesses to anon;

comment on column public.businesses.connect_requirements_due is
    'Stripe onboarding requirements still outstanding. NOT readable by '
    'authenticated or anon (SB-0042) — it describes what a competitor has '
    'failed to provide to Stripe. Backend reads it via service_role only.';
