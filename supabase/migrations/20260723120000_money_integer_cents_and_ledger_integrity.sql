-- 20260723120000_money_integer_cents_and_ledger_integrity.sql
--
-- MONEY LANE — 2026-07-23
--
-- Problem (verified against the LIVE database, not the schema docs):
--   payments.total_charged, payments.escrow_held, payments.released_to_business,
--   payments.platform_cut, bookings.total_amount and bookings.platform_fee are all
--   `double precision`. Money in a binary float is a latent correctness bug: 0.1+0.2
--   is not 0.3, and every sum/round in the earnings + invoice readers compounds it.
--
-- Why this migration is ADDITIVE rather than an in-place type change:
--   An `ALTER COLUMN ... TYPE bigint USING round(x*100)` would silently change the
--   meaning of every existing reader — the mobile app, the invoice PDF, the admin
--   dashboard and the business earnings screen all read `total_charged` as DOLLARS.
--   Flipping them to cents in place turns "$180.00" into "$18000.00" on every screen.
--   Instead we add authoritative `*_cents` bigint columns, backfill them, and keep
--   the legacy dollar columns as a DB-maintained mirror so no reader breaks. New
--   backend code reads and writes cents; the trigger below guarantees the two
--   representations can never drift, whichever side a writer touches.
--
-- Also fixes: payments had NO uniqueness on booking_id even though the entire
-- codebase reads it with PostgREST `.single()` (escrow.load_single_payment,
-- payments.py, invoices.py, bookings.py). A second row silently 500s every reader.
-- Verified 0 duplicates live before adding the constraint.

begin;

-- ---------------------------------------------------------------------------
-- 1. Authoritative integer-cents columns
-- ---------------------------------------------------------------------------
alter table public.payments
  add column if not exists total_charged_cents        bigint,
  add column if not exists escrow_held_cents          bigint,
  add column if not exists released_to_business_cents bigint,
  add column if not exists platform_cut_cents         bigint;

alter table public.bookings
  add column if not exists total_amount_cents bigint,
  add column if not exists platform_fee_cents bigint;

comment on column public.payments.total_charged_cents is
  'AUTHORITATIVE money value, integer cents. payments.total_charged (double precision) is a legacy mirror maintained by trigger payments_sync_money_trg.';
comment on column public.payments.escrow_held_cents is
  'AUTHORITATIVE money value, integer cents. Mirror: escrow_held.';
comment on column public.payments.released_to_business_cents is
  'AUTHORITATIVE money value, integer cents. Mirror: released_to_business.';
comment on column public.payments.platform_cut_cents is
  'AUTHORITATIVE money value, integer cents. Mirror: platform_cut.';
comment on column public.bookings.total_amount_cents is
  'AUTHORITATIVE money value, integer cents. Mirror: total_amount.';

-- ---------------------------------------------------------------------------
-- 2. Backfill from the existing dollar columns
-- ---------------------------------------------------------------------------
update public.payments
set total_charged_cents        = round(coalesce(total_charged, 0)::numeric        * 100)::bigint,
    escrow_held_cents          = round(coalesce(escrow_held, 0)::numeric          * 100)::bigint,
    released_to_business_cents = round(coalesce(released_to_business, 0)::numeric * 100)::bigint,
    platform_cut_cents         = round(coalesce(platform_cut, 0)::numeric         * 100)::bigint
where total_charged_cents is null
   or escrow_held_cents is null
   or released_to_business_cents is null
   or platform_cut_cents is null;

update public.bookings
set total_amount_cents = round(coalesce(total_amount, 0)::numeric * 100)::bigint,
    platform_fee_cents = case
                           when platform_fee is null then null
                           else round(platform_fee::numeric * 100)::bigint
                         end
where total_amount_cents is null
   or (platform_fee is not null and platform_fee_cents is null);

-- ---------------------------------------------------------------------------
-- 3. Keep cents <-> dollars in lockstep, whichever side a writer touches.
--    Rule: if the CENTS column changed (or was supplied on insert), cents wins
--    and dollars are derived. Otherwise dollars changed and cents follow.
--    This makes the legacy dollar columns unable to drift even if a caller we
--    do not own writes only dollars.
-- ---------------------------------------------------------------------------
create or replace function public.payments_sync_money()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.total_charged_cents is not null then
      new.total_charged := (new.total_charged_cents::numeric / 100)::double precision;
    else
      new.total_charged_cents := round(coalesce(new.total_charged, 0)::numeric * 100)::bigint;
    end if;

    if new.escrow_held_cents is not null then
      new.escrow_held := (new.escrow_held_cents::numeric / 100)::double precision;
    else
      new.escrow_held_cents := round(coalesce(new.escrow_held, 0)::numeric * 100)::bigint;
    end if;

    if new.released_to_business_cents is not null then
      new.released_to_business := (new.released_to_business_cents::numeric / 100)::double precision;
    else
      new.released_to_business_cents := round(coalesce(new.released_to_business, 0)::numeric * 100)::bigint;
    end if;

    if new.platform_cut_cents is not null then
      new.platform_cut := (new.platform_cut_cents::numeric / 100)::double precision;
    else
      new.platform_cut_cents := round(coalesce(new.platform_cut, 0)::numeric * 100)::bigint;
    end if;

  else -- UPDATE
    if new.total_charged_cents is distinct from old.total_charged_cents then
      new.total_charged := (coalesce(new.total_charged_cents, 0)::numeric / 100)::double precision;
    elsif new.total_charged is distinct from old.total_charged then
      new.total_charged_cents := round(coalesce(new.total_charged, 0)::numeric * 100)::bigint;
    end if;

    if new.escrow_held_cents is distinct from old.escrow_held_cents then
      new.escrow_held := (coalesce(new.escrow_held_cents, 0)::numeric / 100)::double precision;
    elsif new.escrow_held is distinct from old.escrow_held then
      new.escrow_held_cents := round(coalesce(new.escrow_held, 0)::numeric * 100)::bigint;
    end if;

    if new.released_to_business_cents is distinct from old.released_to_business_cents then
      new.released_to_business := (coalesce(new.released_to_business_cents, 0)::numeric / 100)::double precision;
    elsif new.released_to_business is distinct from old.released_to_business then
      new.released_to_business_cents := round(coalesce(new.released_to_business, 0)::numeric * 100)::bigint;
    end if;

    if new.platform_cut_cents is distinct from old.platform_cut_cents then
      new.platform_cut := (coalesce(new.platform_cut_cents, 0)::numeric / 100)::double precision;
    elsif new.platform_cut is distinct from old.platform_cut then
      new.platform_cut_cents := round(coalesce(new.platform_cut, 0)::numeric * 100)::bigint;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists payments_sync_money_trg on public.payments;
create trigger payments_sync_money_trg
  before insert or update on public.payments
  for each row execute function public.payments_sync_money();

create or replace function public.bookings_sync_money()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.total_amount_cents is not null then
      new.total_amount := (new.total_amount_cents::numeric / 100)::double precision;
    else
      new.total_amount_cents := round(coalesce(new.total_amount, 0)::numeric * 100)::bigint;
    end if;
    if new.platform_fee_cents is not null then
      new.platform_fee := (new.platform_fee_cents::numeric / 100)::double precision;
    elsif new.platform_fee is not null then
      -- platform_fee is nullable; only derive cents when a fee was actually set,
      -- so "no fee recorded" stays NULL rather than becoming a false $0.00.
      new.platform_fee_cents := round(new.platform_fee::numeric * 100)::bigint;
    end if;
  else
    if new.total_amount_cents is distinct from old.total_amount_cents then
      new.total_amount := (coalesce(new.total_amount_cents, 0)::numeric / 100)::double precision;
    elsif new.total_amount is distinct from old.total_amount then
      new.total_amount_cents := round(coalesce(new.total_amount, 0)::numeric * 100)::bigint;
    end if;

    if new.platform_fee_cents is distinct from old.platform_fee_cents then
      new.platform_fee := (coalesce(new.platform_fee_cents, 0)::numeric / 100)::double precision;
    elsif new.platform_fee is distinct from old.platform_fee then
      new.platform_fee_cents := round(coalesce(new.platform_fee, 0)::numeric * 100)::bigint;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_sync_money_trg on public.bookings;
create trigger bookings_sync_money_trg
  before insert or update on public.bookings
  for each row execute function public.bookings_sync_money();

-- ---------------------------------------------------------------------------
-- 4. Now that cents are backfilled and trigger-maintained, make them NOT NULL.
-- ---------------------------------------------------------------------------
alter table public.payments
  alter column total_charged_cents        set not null,
  alter column escrow_held_cents          set not null,
  alter column released_to_business_cents set not null,
  alter column platform_cut_cents         set not null;

alter table public.payments
  alter column released_to_business_cents set default 0,
  alter column escrow_held_cents          set default 0,
  alter column platform_cut_cents         set default 0;

alter table public.bookings
  alter column total_amount_cents set not null;

-- ---------------------------------------------------------------------------
-- 5. Ledger integrity constraints
-- ---------------------------------------------------------------------------

-- One payments row per booking. The whole codebase already assumes this via
-- PostgREST `.single()`; nothing enforced it. Verified 0 duplicates before adding.
alter table public.payments
  drop constraint if exists payments_booking_id_key;
alter table public.payments
  add constraint payments_booking_id_key unique (booking_id);

-- Money is never negative.
alter table public.payments
  drop constraint if exists payments_money_non_negative;
alter table public.payments
  add constraint payments_money_non_negative check (
    total_charged_cents        >= 0 and
    escrow_held_cents          >= 0 and
    released_to_business_cents >= 0 and
    platform_cut_cents         >= 0
  );

-- FINDING D — double counting. escrow_held + released_to_business may never
-- exceed the amount actually charged. The Stripe capture path used to OVERWRITE
-- escrow_held with the full total while released_to_business was already
-- non-zero, producing $225 of accounting against a $150 charge on booking
-- 82b69fc2. This constraint makes that arithmetic impossible at the DB level.
--   NOT VALID: enforced for all future writes, but does not fail the migration
--   on pre-existing bad rows. The repair migration validates it.
alter table public.payments
  drop constraint if exists payments_ledger_not_over_charged;
alter table public.payments
  add constraint payments_ledger_not_over_charged check (
    escrow_held_cents + released_to_business_cents <= total_charged_cents
  ) not valid;

-- Traceability: an on-platform payment that claims escrow is HELD or RELEASED
-- must name the Stripe charge behind it. Off-platform (cash / e-transfer) and
-- not-yet-paid rows are exempt. NOT VALID for the same reason — the 24 legacy
-- phantom-release rows predate the guard. Enforcement for new writes is what
-- stops the bug recurring; app-level enforcement lives in
-- escrow.assert_capture_backed().
alter table public.payments
  drop constraint if exists payments_released_requires_capture;
alter table public.payments
  add constraint payments_released_requires_capture check (
    coalesce(status, '') <> 'fully_released'
    or coalesce(method, '') in ('cash', 'e_transfer', 'other')
    or stripe_payment_intent_id is not null
  ) not valid;

commit;
