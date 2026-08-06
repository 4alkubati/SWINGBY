-- 20260806040000_payouts_rls.sql
--
-- RLS for `public.payouts`. Follow-up to 20260803120000_stripe_connect_payouts.sql,
-- which created the table and never enabled row-level security on it.
--
-- WHY THIS IS SEPARATE, NOT AN EDIT TO THAT FILE
-- ----------------------------------------------
-- 20260803120000 is already on `main` (it arrived with PR #98, not #97). Editing
-- a migration that has shipped means anyone who applied it gets no fix. This one
-- is additive and safe to run whether or not the table already had policies.
--
-- WHAT WAS WRONG
-- --------------
-- `payouts` is a money table — amount, Stripe transfer id, Stripe payout id, per
-- business — reachable through PostgREST like every other table in `public`.
-- It shipped with `relrowsecurity = false` while every comparable table
-- (`payments`, `bookings`, `businesses`, `user_credits`, `disputes`,
-- `content_reports`, `user_blocks`) has RLS on. Verified against the live
-- project 2026-08-06: those seven were all `true`, `payouts` did not exist yet,
-- so nothing was ever exposed in production — this closes the hole before the
-- table is created rather than after.
--
-- THE POLICY SHAPE, AND WHY THERE IS NO WRITE POLICY
-- ---------------------------------------------------
-- Mirrors `user_credits`: read-your-own plus an admin-all, and nothing else.
-- Writes are deliberately absent. `payouts` rows are written only by
-- `POST /businesses/me/payouts` using the service_role key, which bypasses RLS —
-- so an absent insert/update/delete policy is the enforcement, not an oversight.
-- A client that could insert its own payout row could claim money it never
-- earned; the available balance is derived from `payments`, but the unsettled
-- subtraction reads `payouts.stripe_transfer_id`, so a forged row is a direct
-- path to double-spending a balance.
--
-- Ownership is indirect: `payouts.business_id -> businesses.owner_id -> auth.uid()`,
-- the same hop `payments_select` makes through `bookings`.

begin;

alter table public.payouts enable row level security;

drop policy if exists payouts_read_own on public.payouts;
create policy payouts_read_own on public.payouts
  for select
  using (
    business_id in (
      select businesses.id
      from public.businesses
      where businesses.owner_id = auth.uid()
    )
  );

drop policy if exists payouts_admin_all on public.payouts;
create policy payouts_admin_all on public.payouts
  for all
  using (
    exists (
      select 1
      from public.users u
      where u.id = auth.uid()
        and u.role = 'admin'
    )
  );

commit;
