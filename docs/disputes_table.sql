-- Migration: create disputes table + RLS.
-- Written 2026-07-01 for F2 (audit) — unblocks DisputeFlowScreen submit.
-- Apply via Supabase SQL editor OR the mcp Supabase apply_migration tool.

CREATE TABLE IF NOT EXISTS public.disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    opened_by UUID NOT NULL REFERENCES public.users(id),
    against_party TEXT NOT NULL CHECK (against_party IN ('client', 'business')),
    issue_type TEXT NOT NULL CHECK (issue_type IN ('no_show', 'poor_quality', 'damage', 'overcharge', 'safety', 'other')),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'under_review', 'resolved', 'dismissed')),
    resolution_notes TEXT,
    refund_amount NUMERIC(10, 2),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS disputes_booking_idx ON public.disputes(booking_id);
CREATE INDEX IF NOT EXISTS disputes_opened_by_idx ON public.disputes(opened_by);
CREATE INDEX IF NOT EXISTS disputes_status_idx ON public.disputes(status);

ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

-- Parties to the booking can read
CREATE POLICY disputes_read_parties ON public.disputes
    FOR SELECT
    USING (
        opened_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = disputes.booking_id
              AND (b.client_id = auth.uid() OR EXISTS (
                  SELECT 1 FROM public.businesses biz
                  WHERE biz.id = b.business_id AND biz.owner_id = auth.uid()
              ))
        )
    );

-- Admins read/write all
CREATE POLICY disputes_admin_all ON public.disputes
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'admin')
    );

-- Backend writes via service_role — bypasses RLS.

-- Timestamp trigger
CREATE OR REPLACE FUNCTION update_disputes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS disputes_updated_at ON public.disputes;
CREATE TRIGGER disputes_updated_at
    BEFORE UPDATE ON public.disputes
    FOR EACH ROW
    EXECUTE FUNCTION update_disputes_updated_at();
