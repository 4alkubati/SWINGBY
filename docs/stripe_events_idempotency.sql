-- Applied via Supabase MCP on 2026-07-21 (project ulnxapnsenzyddddldjt).
-- Webhook idempotency for Stripe events (fix E).
--
-- payments_stripe.py records every processed Stripe event id here and skips any
-- event id it has already seen. Without this, a replayed
-- `checkout.session.completed` re-runs side effects and could regress a
-- fully_released payment back to paid_full.
--
-- Keyed by the Stripe event id (evt_...), which is globally unique and stable
-- across Stripe's retry/replay delivery.

CREATE TABLE IF NOT EXISTS stripe_events (
    event_id    text PRIMARY KEY,
    event_type  text,
    processed_at timestamptz NOT NULL DEFAULT now()
);

-- Backend uses the service_role key (bypasses RLS), but enable RLS with no
-- policies so nothing else can read/write this ledger-adjacent table.
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
