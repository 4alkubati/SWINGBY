-- =============================================================================
-- 20260727000000_charge_at_post.sql
--
-- AMENDMENT 1 to the payment model (agents/briefs/PAYMENT-MODEL.md, 2026-07-26).
-- Kira's ruling, handwritten after describing it seven times:
--
--     Posting a quota -> ... -> Post + Pay (SAME BUTTON)
--     Budget 150, accept 100 -> 50 released, 50 escrow, 50 REFUNDED
--
-- Posting now CHARGES the client's full budget. The unused part is refunded
-- when a cheaper quote is accepted, and the whole amount is refunded if the
-- post expires with no accepted quote.
--
-- ---------------------------------------------------------------------------
-- WHY THIS MIGRATION IS REQUIRED BEFORE ANY CODE
-- ---------------------------------------------------------------------------
-- `payments.booking_id` is NOT NULL. Every payments row today hangs off a
-- booking. But under this model money is taken at POST time, when no booking
-- exists and may never exist -- if nobody quotes, there is only ever a post and
-- a refund. There is currently nowhere to record that money.
--
-- Two options were considered:
--   (a) a second table for pre-booking charges, or
--   (b) one payments row per money-flow, created at post, which later gains its
--       booking_id when a quote is accepted.
-- (b) is used. A single row means the ledger invariant is checkable in one
-- place and a refund never has to be reconciled across two tables. It also
-- means `total_charged` keeps its meaning -- what the card was actually
-- charged -- rather than becoming "what the job cost".
--
-- ---------------------------------------------------------------------------
-- THE INVARIANT THIS ENABLES
-- ---------------------------------------------------------------------------
--   escrow_held + released_to_business + platform_cut + refunded == total_charged
--
-- in EVERY state, including the two new ones:
--   posted, not yet quoted : escrow = total,  refunded = 0
--   expired, never accepted: escrow = 0,      refunded = total
--
-- The CHECK constraint at the bottom enforces it in the database, in cents, so
-- a future code path physically cannot write a row that does not balance. The
-- original spec (S3) says "a test enforces this"; a test only covers the paths
-- someone remembered to write. This covers all of them.
--
-- Everything here is ADDITIVE and idempotent. No drops, no data rewrite beyond
-- backfilling two new columns to 0.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Money can now exist against a POST, before any booking
-- ---------------------------------------------------------------------------
alter table public.payments
    alter column booking_id drop not null;

alter table public.payments
    add column if not exists post_id uuid references public.service_posts(id) on delete set null;

comment on column public.payments.post_id is
  'The service_post whose budget was charged. Set at post time (Flow A, charge-at-post). booking_id is NULL until a quote is accepted, and both are set thereafter. NULL for Flow B rows, which are only ever created at accept.';

comment on column public.payments.booking_id is
  'NULL between posting and quote acceptance. Under charge-at-post (AMENDMENT 1) money is taken before a booking exists, and if nobody quotes, no booking ever will -- the row settles as a full refund.';

-- A payments row must be ABOUT something. Without this, a bug that forgets both
-- ids produces an orphaned charge nobody can refund.
alter table public.payments
    drop constraint if exists payments_has_a_subject;
alter table public.payments
    add constraint payments_has_a_subject
    check (booking_id is not null or post_id is not null);

create index if not exists payments_post_id_idx on public.payments (post_id);

-- ---------------------------------------------------------------------------
-- 2. Refunds are first-class, not a status
-- ---------------------------------------------------------------------------
-- A row can be `held` AND partly refunded at the same time (budget 150,
-- accepted 100: 90 working, 50 back, still an active job). A status string
-- cannot express that, so the amount gets its own column. Cents are
-- authoritative; the float mirrors the existing columns for legacy readers.
alter table public.payments
    add column if not exists refunded_cents bigint not null default 0;
alter table public.payments
    add column if not exists refunded double precision not null default 0;
alter table public.payments
    add column if not exists stripe_refund_id text;
alter table public.payments
    add column if not exists refunded_at timestamptz;

comment on column public.payments.refunded_cents is
  'Cumulative amount returned to the client, in cents. AUTHORITATIVE. Non-zero alongside an active status is normal and expected: accepting below budget refunds the difference while the job proceeds.';

comment on column public.payments.stripe_refund_id is
  'Most recent Stripe Refund id. Presence is the only proof money actually went back -- never mark a row refunded from application logic alone (this is the FINDING C lesson: 24 rows and $4,675.50 claimed released with no PaymentIntent behind them).';

-- ---------------------------------------------------------------------------
-- 3. The ledger must balance, enforced by the database
-- ---------------------------------------------------------------------------
-- Cash jobs are exempt: the platform never held the principal, so the sum is
-- meaningless there (spec S6). They are identified by method, since there is no
-- is_cash column on this table.
-- NOT VALID is deliberate and load-bearing.
--
-- 12 of the 30 existing rows do NOT balance (checked 2026-07-26 against the
-- live project): 6 rows status='fully_released' totalling $1,975 with zero in
-- every component, 3 status='held' for $1,185 holding nothing, and 3 with a
-- platform cut booked before any charge. NONE of the 12 has a
-- stripe_payment_intent_id, so none of them represents money that ever moved --
-- they are seed and test artifacts from before the cents columns existed.
--
-- A plain CHECK would abort this migration. "Fixing" them inline would be worse:
-- zeroing the amounts silently destroys the only record of what those bookings
-- were meant to cost, and stuffing the total into escrow_held would assert that
-- money is held when it is not -- the exact lie (audit L5) fixed hours ago.
--
-- NOT VALID enforces the invariant on every INSERT and UPDATE from now on while
-- leaving the historical rows untouched for a decision that belongs to Kira.
-- Once they are reconciled or deleted:
--     alter table public.payments validate constraint payments_ledger_balances;
-- which re-checks the existing rows without taking a write lock on new ones.
alter table public.payments
    drop constraint if exists payments_ledger_balances;
alter table public.payments
    add constraint payments_ledger_balances
    check (
        coalesce(method, '') = 'off_platform'
        or escrow_held_cents
           + released_to_business_cents
           + platform_cut_cents
           + refunded_cents
           = total_charged_cents
    ) not valid;

commit;
