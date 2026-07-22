-- Migration: create user_credits ledger + RLS.
-- Applied via Supabase MCP apply_migration on 2026-07-21 (project
-- ulnxapnsenzyddddldjt) in the same PR as backend/app/services/credits.py.
--
-- A minimal, auditable customer-credit system. Each row is a SIGNED cents
-- delta on a user's credit balance:
--     + amount_cents  → a GRANT      (goodwill accrued to the user)
--     - amount_cents  → a REDEMPTION (credit spent against a booking charge)
-- Balance = SUM(amount_cents). We deliberately store an append-only ledger
-- rather than a single mutable wallet column so every movement is auditable.
--
-- Today the only grant path is the cancellation ladder: when a BUSINESS
-- cancels late (<=48h) or no-shows, the client is made whole AND handed a flat
-- goodwill credit (credits.GOODWILL_CREDIT_CENTS). Redemption-at-checkout is
-- BUILT but gated OFF (credits.CREDIT_REDEMPTION_AT_CHECKOUT_ENABLED) until the
-- charge-before-service Stripe capture path is verified in test mode.
--
-- NOTE: this is unrelated to referrals.credit_cents (a different, always-0
-- concept — see docs/referrals_table.sql).

CREATE TABLE IF NOT EXISTS public.user_credits (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents <> 0),  -- signed: + grant, - redemption
    reason       TEXT NOT NULL,
    booking_id   UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_credits_user_idx ON public.user_credits (user_id);
CREATE INDEX IF NOT EXISTS user_credits_booking_idx ON public.user_credits (booking_id);

-- Anti-double-spend: at most ONE redemption debit per booking. This DB
-- constraint (not application locking) is what makes redeem_credit_for_booking
-- safe under concurrent/retried checkout calls — the second debit insert fails
-- and the caller treats it idempotently. Grants (amount_cents > 0) are not
-- constrained here.
CREATE UNIQUE INDEX IF NOT EXISTS user_credits_one_redemption_per_booking_uidx
    ON public.user_credits (booking_id)
    WHERE booking_id IS NOT NULL AND amount_cents < 0;

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- A user can read their own credit ledger.
CREATE POLICY user_credits_read_own ON public.user_credits
    FOR SELECT
    USING (user_id = auth.uid());

-- Admins read/write all.
CREATE POLICY user_credits_admin_all ON public.user_credits
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    );

-- INSERT/UPDATE for non-admins intentionally not exposed — all backend writes
-- go through the service_role key, which bypasses RLS (same rule-of-thumb as
-- referrals_table.sql / disputes_table.sql).
