-- 20260803120000_stripe_connect_payouts.sql
--
-- D5 — PAYOUTS. The business can take its money out.
--
-- RULING (Kira, 2026-08-04): "a business needs to take the money out, and they
-- can in an instant." That is Stripe Connect (Express accounts) plus an instant
-- payout to a debit card — not a manual e-transfer that someone marks settled.
--
-- WHAT THIS MIGRATION IS FOR
-- --------------------------
-- Before it, the ledger stopped at `payments.released_to_business`. That column
-- is bookkeeping: it records what a business has EARNED. Nothing in the
-- codebase ever moved a dollar to a business — `git grep -i payout` on
-- origin/main returned comments and one mislabelled stat card, and there was no
-- `stripe_account`/`account_link`/`transfer` call anywhere. D8's own log says
-- it plainly: "create_transfer built but left unwired: no Stripe Connect
-- onboarding exists anywhere in the codebase."
--
-- Two additions, both additive and both safe to re-run:
--
--   1. `businesses` gains the connected-account id and a cached mirror of the
--      account's KYC/payouts state. The mirror exists so a screen can render
--      without a synchronous Stripe round-trip; Stripe stays authoritative and
--      `connect_synced_at` says how stale the mirror is.
--
--   2. `payouts` — one row per attempt to move money out. This is a LEDGER of
--      money movement, deliberately separate from `payments` (which is a ledger
--      of what was earned per booking). A payout is not per-booking: it drains
--      whatever the business has accrued across many bookings at once, which is
--      the batched model D8 specifies.
--
-- WHY THE BALANCE IS NOT A COLUMN
-- -------------------------------
-- There is deliberately no `businesses.available_balance_cents`. A stored
-- balance is a second source of truth that drifts from `payments` the first
-- time a write half-fails, and this repo already has FINDING C ($4,675.50 of
-- `fully_released` rows with no Stripe charge behind them) to show what a
-- believed-but-wrong money number costs. The available balance is DERIVED on
-- every read:
--
--     available = (capture-backed released_to_business)
--               - (payouts whose money actually left the platform)
--
-- The first term is `verified_released_cents`, already computed by
-- `GET /payments/mine` — capture-backed only, so the phantom FINDING C rows
-- cannot be paid out. The second term is the sum of payout rows with a
-- non-null `stripe_transfer_id`: the transfer is the moment platform money
-- becomes the business's money, so a payout that failed BEFORE its transfer
-- correctly does not reduce the balance, and one that failed AFTER it
-- correctly does.
--
-- NO SCHEDULER (still true on this deployment — see Roadmap/STATUS.md §2).
-- A standard payout sits `in_transit` for days and nothing here polls it. Rows
-- are re-read from Stripe and settled lazily when the business opens the wallet
-- (`GET /businesses/me/payouts`). Nothing in this schema assumes a timer.

begin;

-- ---------------------------------------------------------------------------
-- 1. The connected account, on the business row
-- ---------------------------------------------------------------------------

alter table public.businesses
  add column if not exists stripe_connect_account_id text,
  add column if not exists payouts_enabled boolean not null default false,
  add column if not exists connect_charges_enabled boolean not null default false,
  add column if not exists connect_details_submitted boolean not null default false,
  add column if not exists connect_disabled_reason text,
  add column if not exists connect_requirements_due text[],
  add column if not exists connect_synced_at timestamptz;

comment on column public.businesses.stripe_connect_account_id is
  'Stripe Connect Express account (acct_…) that receives this business''s payouts. NULL = onboarding never started. Test-mode ids during beta; the whole beta runs on sk_test_.';

comment on column public.businesses.payouts_enabled is
  'Mirror of the connected account''s `payouts_enabled`. Stripe is authoritative — this is a cache so the wallet can paint without a blocking API call. Never gate a payout on this alone; app/api/payouts.py re-reads Stripe before moving money.';

comment on column public.businesses.connect_details_submitted is
  'Mirror of the connected account''s `details_submitted` — the person finished the Express onboarding form. True with payouts_enabled false means Stripe is still verifying, or something in `connect_requirements_due` is outstanding.';

comment on column public.businesses.connect_disabled_reason is
  'Mirror of `requirements.disabled_reason`. Non-null means Stripe has stopped payouts for this account and says why.';

comment on column public.businesses.connect_requirements_due is
  'Mirror of `requirements.currently_due` — the fields Stripe still wants. Shown to the owner so "finish setup" names what is missing instead of being a dead end.';

comment on column public.businesses.connect_synced_at is
  'When the four mirror columns were last refreshed from Stripe. NULL = never synced; the mirror is meaningless and the caller must hit Stripe.';

-- One Stripe account per business, and one business per Stripe account. Without
-- this, a retried "create my payout account" that lost its response writes a
-- second acct_ id over the first and the original account — which may already
-- hold transferred funds — becomes unreachable.
create unique index if not exists businesses_stripe_connect_account_id_key
  on public.businesses (stripe_connect_account_id)
  where stripe_connect_account_id is not null;

-- ---------------------------------------------------------------------------
-- 2. The payout ledger
-- ---------------------------------------------------------------------------

create table if not exists public.payouts (
  id                  uuid primary key default gen_random_uuid(),
  business_id         uuid not null references public.businesses (id) on delete cascade,

  -- Integer cents, like every other money figure in this schema since
  -- 20260723120000. There is no float dollar mirror here on purpose: nothing
  -- legacy reads this table, so it starts clean.
  amount_cents        bigint not null check (amount_cents > 0),
  currency            text   not null default 'cad',

  -- Mirrors Stripe's own payout statuses rather than inventing a parallel
  -- vocabulary — this repo already carries the cost of two payment-status
  -- vocabularies that must both be read forever (escrow.HELD_NOT_RELEASED).
  --   pending     row created; nothing has been sent to Stripe yet
  --   in_transit  Stripe has the payout and is moving it (standard: 1–3 days)
  --   paid        landed
  --   failed      Stripe rejected it, or a call raised. See failure_reason.
  --   canceled    cancelled at Stripe
  status              text   not null default 'pending'
                      check (status in ('pending', 'in_transit', 'paid', 'failed', 'canceled')),

  -- Which rail actually carried it. NULL until the payout is created, because
  -- eligibility is read from the account's external accounts at send time and
  -- may differ from what the wallet predicted. The UI must report the value
  -- that ended up here, never the prediction.
  method              text   check (method in ('instant', 'standard')),

  stripe_account_id   text,
  -- Platform balance -> connected account. THE column that decides whether this
  -- row reduces the business's available balance (see header). Non-null means
  -- the money is no longer the platform's, regardless of what `status` says.
  stripe_transfer_id  text,
  -- Connected account -> the business's card/bank.
  stripe_payout_id    text,
  arrival_date        timestamptz,
  failure_reason      text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.payouts is
  'Money leaving SwingBy for a business. One row per cash-out attempt, NOT per booking — a payout drains accrued earnings across many bookings (the batched model in Roadmap/dominoes/D8-money-uber.md). Written only by POST /businesses/me/payouts.';

comment on column public.payouts.stripe_transfer_id is
  'Stripe Transfer (platform -> connected account). Its presence, not `status`, is what subtracts this row from the available balance: once the transfer lands the money belongs to the business even if the subsequent payout failed and the funds are sitting on their connected account.';

comment on column public.payouts.method is
  'The rail that actually carried this payout, filled in after Stripe accepted it. `instant` requires a debit card whose available_payout_methods include "instant"; everything else falls back to `standard`. Never render a predicted value from this column.';

-- The wallet reads "my payouts, newest first" and the balance sums this table
-- per business. Both are covered by one composite index.
create index if not exists payouts_business_created_idx
  on public.payouts (business_id, created_at desc);

-- Settle-on-read (there is no scheduler) scans for rows Stripe may have moved
-- since we last looked: anything not in a terminal state that Stripe knows about.
create index if not exists payouts_unsettled_idx
  on public.payouts (stripe_payout_id)
  where status in ('pending', 'in_transit');

-- A Stripe payout id must map to exactly one row, or a settle-on-read pass can
-- mark the wrong row paid.
create unique index if not exists payouts_stripe_payout_id_key
  on public.payouts (stripe_payout_id)
  where stripe_payout_id is not null;

create unique index if not exists payouts_stripe_transfer_id_key
  on public.payouts (stripe_transfer_id)
  where stripe_transfer_id is not null;

commit;
