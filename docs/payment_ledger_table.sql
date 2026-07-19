-- CARD-21 — payment_ledger: internal EXPECTED-vs-ACTUAL money reconciliation.
-- NOT YET APPLIED to the live project — filed for database-agent / Kira
-- review. Backend-agent does not own schema changes; this is the required
-- DDL for the money ledger backend/app/services/money_ledger.py already
-- writes to (best-effort — every write there is wrapped in try/except so
-- the booking/payment flow it observes never breaks if this table doesn't
-- exist yet).
--
-- Purpose (the actual point of CARD-21): every sandbox booking should show
-- the EXPECTED amounts (computed the moment the booking is created — total
-- price, 10% platform cut, business share) side by side with the ACTUAL
-- Stripe objects that moved money (checkout session, payment intent,
-- refund) as they happen. A mismatch must be VISIBLE, never silently
-- reconciled — see the `mismatch` / `mismatch_notes` columns, set by
-- money_ledger.py's `_mismatch()` helper (>1 cent difference).
--
-- One row per booking, opened at accept-interest time, updated at three
-- points in the booking lifecycle:
--   1. accept_interest        -> INSERT, status='pending'          (expected_* only)
--   2. webhook checkout done  -> UPDATE, status='captured'         (+ stripe_checkout_session_id, stripe_payment_intent_id, actual_captured_amount)
--   3. complete_booking       -> UPDATE, status='completed_released' (+ actual_business_share_released)
--      OR cancel_booking      -> UPDATE, status='refunded'          (+ stripe_refund_id, actual_refund_amount)

CREATE TABLE IF NOT EXISTS public.payment_ledger (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id                      uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  payment_id                      uuid REFERENCES public.payments(id) ON DELETE SET NULL,

  -- Expected — computed from bookings.total_amount / commission_rate the
  -- moment the booking is created. Never touched by Stripe data.
  expected_total                  numeric NOT NULL,
  expected_platform_cut           numeric NOT NULL,
  expected_business_share         numeric NOT NULL,
  expected_penalty                numeric,          -- filled on cancel

  -- Actual — mirrors real Stripe objects, filled in as the booking's money
  -- events actually happen. NULL until that event occurs.
  stripe_checkout_session_id      text,
  stripe_payment_intent_id        text,
  stripe_charge_id                text,
  stripe_refund_id                text,
  actual_captured_amount          numeric,
  actual_stripe_fee               numeric,
  actual_business_share_released  numeric,
  actual_refund_amount            numeric,

  status                          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'captured', 'completed_released', 'refunded', 'mismatch')),
  mismatch                        boolean NOT NULL DEFAULT false,
  mismatch_notes                  text,

  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_ledger_booking_id_idx
  ON public.payment_ledger (booking_id);

CREATE INDEX IF NOT EXISTS payment_ledger_mismatch_idx
  ON public.payment_ledger (mismatch) WHERE mismatch = true;

-- updated_at bump — mirrors the pattern used elsewhere in this repo's filed
-- migrations that touch mutable rows (kept minimal: no trigger dependency
-- beyond pg's built-in now()).
CREATE OR REPLACE FUNCTION public.payment_ledger_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_ledger_updated_at ON public.payment_ledger;
CREATE TRIGGER payment_ledger_updated_at
  BEFORE UPDATE ON public.payment_ledger
  FOR EACH ROW EXECUTE FUNCTION public.payment_ledger_set_updated_at();

ALTER TABLE public.payment_ledger ENABLE ROW LEVEL SECURITY;

-- Internal reconciliation view — admin only. This is deliberately NOT
-- visible to clients or businesses (it exposes raw Stripe object ids and
-- platform-cut math); GET /payments/{booking_id} remains the client/business
-- facing payment summary, unchanged by this card.
CREATE POLICY payment_ledger_admin_select ON public.payment_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- All writes go through the service-role client (backend/app/services/money_ledger.py),
-- same as every other money table in this schema (payments, bookings) — no
-- INSERT/UPDATE policy needed for anon/authenticated roles.
