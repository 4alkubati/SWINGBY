-- 20260819130000_revoke_connect_columns.sql
--
-- SB-0042 — extend the 2026-07-20 column lockdown to the columns added after it.
--
-- `20260720000000_s1_column_lockdown_and_unique_constraints.sql` revoked
-- SELECT on businesses.license_number, stripe_customer_id, subscription_id and
-- subscription_current_period_end from `authenticated`, because
-- `businesses_select_authenticated` is `using (true)` — every signed-in user
-- can read every business row, so column grants are the only thing narrowing
-- it.
--
-- Stripe Connect landed on 2026-08-03 and added seven more columns of exactly
-- the same kind. Nobody went back to the REVOKE, so `stripe_connect_account_id`
-- and its siblings have been readable by any authenticated Supabase JWT ever
-- since — including `connect_requirements_due`, which spells out precisely what
-- Stripe is still missing from that business.
--
-- This is a different layer from SB-0014. That one stopped the API handing
-- these columns back in `GET /businesses/*` responses. This one stops a client
-- going directly to PostgREST with its own JWT and asking for them, which the
-- API fix does nothing about.
--
-- The backend is unaffected: every read of these columns goes through the
-- service_role client in payments_stripe.py / payouts.py, and service_role
-- bypasses grants.
--
-- Also revoked: subscription_tier, subscription_status, subscription_price_id,
-- subscription_started_at, subscription_cancel_at. The 2026-07-20 pass took the
-- id and the period end but left the rest of the billing shape, which together
-- still describes what a competitor is paying and when they are up for renewal.

revoke select (
    -- Stripe Connect (added 2026-08-03)
    stripe_connect_account_id,
    payouts_enabled,
    connect_charges_enabled,
    connect_details_submitted,
    connect_disabled_reason,
    connect_requirements_due,
    connect_synced_at,
    -- Billing shape the first pass left behind
    subscription_tier,
    subscription_status,
    subscription_price_id,
    subscription_started_at,
    subscription_cancel_at
) on businesses from authenticated;

-- anon has no business reading any of it either. Harmless if already absent.
revoke select (
    stripe_connect_account_id,
    payouts_enabled,
    connect_charges_enabled,
    connect_details_submitted,
    connect_disabled_reason,
    connect_requirements_due,
    connect_synced_at,
    subscription_tier,
    subscription_status,
    subscription_price_id,
    subscription_started_at,
    subscription_cancel_at,
    license_number,
    stripe_customer_id,
    subscription_id,
    subscription_current_period_end
) on businesses from anon;

comment on column public.businesses.connect_requirements_due is
    'Stripe onboarding requirements still outstanding. NOT readable by '
    'authenticated (SB-0042) — it describes what a competitor has failed to '
    'provide to Stripe. Backend reads it via service_role only.';
