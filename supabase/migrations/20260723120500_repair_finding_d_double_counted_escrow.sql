-- 20260723120500_repair_finding_d_double_counted_escrow.sql
--
-- MONEY LANE — 2026-07-23. Data repair for FINDING D (double counting).
--
-- Depends on 20260723120000 (the *_cents columns + the
-- payments_ledger_not_over_charged CHECK, added NOT VALID).
--
-- Booking 82b69fc2 took ONE real $150 Stripe charge (the only row in the whole
-- table with a genuine PaymentIntent). The capture webhook wrote
-- escrow_held = total_charged = $150 while released_to_business was already
-- $75, so the ledger claimed $225 of accounting against $150 of money — and the
-- business Earnings screen adds the two together.
--
-- The correct invariant (now enforced by escrow.compute_capture_hold in code):
--   escrow_held = max(total_charged - released_to_business, 0)
-- For this row: 15000 - 7500 = 7500 cents held, $75 already out, $150 total. Sound.
--
-- This repair targets the ONE known double-counted row by id, then repairs any
-- other row that violates the same invariant, generically. It touches ONLY the
-- escrow figure — it does not move released_to_business, does not change status,
-- and does not fabricate a PaymentIntent. Seed rows are left otherwise intact.

begin;

-- 1. The specific known offender (idempotent — only acts if still wrong).
update public.payments
set escrow_held_cents = greatest(total_charged_cents - released_to_business_cents, 0)
where booking_id = '82b69fc2-384e-4e2a-889a-4eaff87684e2'
  and escrow_held_cents + released_to_business_cents > total_charged_cents;

-- 2. Any other row that over-counts the same way (belt and suspenders — the
--    live sweep on 2026-07-23 found only 82b69fc2, but this makes the repair
--    self-contained and re-runnable).
update public.payments
set escrow_held_cents = greatest(total_charged_cents - released_to_business_cents, 0)
where escrow_held_cents + released_to_business_cents > total_charged_cents;

-- 3. Now that no row over-counts, VALIDATE the constraint the previous migration
--    added NOT VALID, so the invariant is enforced against existing rows too.
alter table public.payments
  validate constraint payments_ledger_not_over_charged;

commit;
