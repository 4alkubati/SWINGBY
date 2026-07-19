-- Migration: create referrals table + RLS.
-- Written 2026-07-18 for GAP-AUDIT-2026-07-18 #4 (Kira's call: build the
-- rails properly; credit APPLICATION stays OFF for beta — this table only
-- tracks code ownership + claims, nothing ever automatically debits/credits
-- a wallet or booking).
-- Apply via Supabase SQL editor OR the mcp Supabase apply_migration tool.
-- FILE ONLY — do not apply to prod; database-agent reviews and applies.
--
-- Design (see backend/app/api/me.py::get_my_referrals and
-- backend/app/api/auth.py::signup for the two write paths):
--   - "registry" row: referee_id IS NULL. One per user who has ever fetched
--     GET /me/referrals — this is where their own shareable `code` lives.
--   - "claim" row: referee_id IS NOT NULL. Written once, at signup, when a
--     new user's SignupRequest.referral_code matches a live registry row.
--     The same `code` value is copied onto the claim row for audit/history;
--     it is NOT a second, independent code.
-- credit_cents is always 0 today — nothing in this migration or the
-- backend writes a non-zero value. The column exists so a future "credit
-- application" pass (explicitly out of scope for beta) has somewhere to
-- put it without a second migration.

CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL,
    referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referee_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'joined', 'credited')),
    credit_cents INTEGER NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT referrals_no_self_referral CHECK (referee_id IS NULL OR referee_id <> referrer_id)
);

-- At most one live registry row (code) per referrer.
CREATE UNIQUE INDEX IF NOT EXISTS referrals_one_registry_per_referrer_uidx
    ON public.referrals (referrer_id)
    WHERE referee_id IS NULL;

-- At most one referrer owns a given code (registry rows only — claim rows
-- intentionally reuse their registry row's code, so the constraint would be
-- wrong if applied table-wide).
CREATE UNIQUE INDEX IF NOT EXISTS referrals_code_registry_uidx
    ON public.referrals (code)
    WHERE referee_id IS NULL;

CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_id);
CREATE INDEX IF NOT EXISTS referrals_referee_idx ON public.referrals (referee_id);
CREATE INDEX IF NOT EXISTS referrals_code_idx ON public.referrals (code);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- A user can read rows where they are the referrer (their own registry +
-- everyone they've referred) or the referee (the claim that referred them).
CREATE POLICY referrals_read_own ON public.referrals
    FOR SELECT
    USING (referrer_id = auth.uid() OR referee_id = auth.uid());

-- Admins read/write all.
CREATE POLICY referrals_admin_all ON public.referrals
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    );

-- INSERT/UPDATE for non-admins intentionally not exposed — backend writes
-- always go through service_role, which bypasses RLS (see disputes_table.sql
-- / booking_events_and_photos.sql for the same rule-of-thumb).

-- Timestamp trigger
CREATE OR REPLACE FUNCTION update_referrals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS referrals_updated_at ON public.referrals;
CREATE TRIGGER referrals_updated_at
    BEFORE UPDATE ON public.referrals
    FOR EACH ROW
    EXECUTE FUNCTION update_referrals_updated_at();
