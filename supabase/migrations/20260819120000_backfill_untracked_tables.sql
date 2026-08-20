-- 20260819120000_backfill_untracked_tables.sql
--
-- SB-0043 / SB-0044 — schema split-brain.
--
-- Three tables exist in the live database and are written by the API, but have
-- no CREATE TABLE anywhere in supabase/migrations/:
--
--   * push_tokens   — written by app/api/push_tokens.py
--   * audit_log     — written by app/services/audit.py (record_audit)
--   * stripe_events — the idempotency ledger the Stripe webhook HARD-DEPENDS on;
--                     its DDL lived only in docs/stripe_events_idempotency.sql,
--                     outside the pipeline entirely
--
-- So a fresh environment built from the migrations — a staging project, a
-- restore, a new developer's local Supabase — comes up WITHOUT them, and the
-- first Stripe webhook it receives fails on a missing table. The webhook claims
-- idempotency it cannot deliver in any environment but the one where somebody
-- once ran the DDL by hand.
--
-- Written from the LIVE definitions (read 2026-08-19), so applying this to
-- production is a no-op: every statement is IF NOT EXISTS, and the policies are
-- guarded. It exists to make a fresh environment match production, not to
-- change production.
--
-- RLS: all three are enabled live and stay enabled here. None of them is ever
-- read through PostgREST by a user-scoped client — the backend touches them
-- with the service-role key, which bypasses RLS — so "enabled with no policy"
-- is the correct, deliberate posture: deny-all to anon and authenticated.

-- ── push_tokens ─────────────────────────────────────────────────────────────
create table if not exists public.push_tokens (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid references public.users (id) on delete cascade,
    token       text not null,
    platform    text,
    created_at  timestamptz default now(),
    updated_at  timestamptz default now()
);

-- SB-0087 — one row per DEVICE token, not per (user, token) pair.
--
-- Adding this index failed on first attempt against production:
--
--   ERROR 23505: could not create unique index "push_tokens_token_key"
--   DETAIL: Key (token)=(ExponentPushToken[Qglc...]) is duplicated.
--
-- One physical device had accumulated FOUR rows for four different users
-- between 2026-07-31 and 2026-08-18, because register_push_token upserted on
-- (user_id, token). A push addressed to any one of those users was delivered
-- to whoever happened to be holding that device.
--
-- So the duplicates are removed first, keeping the most recent registration —
-- the device's current owner is the last person who logged in on it. The
-- losers stop receiving push until they next open the app, which re-registers
-- them; that is the correct outcome, because they were receiving someone
-- else's notifications.
delete from public.push_tokens p
using public.push_tokens q
where p.token = q.token
  and (p.created_at < q.created_at
       or (p.created_at = q.created_at and p.id < q.id));

create unique index if not exists push_tokens_token_key
    on public.push_tokens (token);

create index if not exists push_tokens_user_id_idx
    on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- ── audit_log ───────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
    id             uuid primary key default gen_random_uuid(),
    actor_id       uuid references public.users (id) on delete set null,
    action         text not null,
    resource_type  text,
    resource_id    uuid,
    metadata       jsonb default '{}'::jsonb,
    ip             text,
    created_at     timestamptz default now()
);

-- The two questions this table is ever asked: "what did this admin do?" and
-- "what happened to this thing?".
create index if not exists audit_log_actor_idx
    on public.audit_log (actor_id, created_at desc);

create index if not exists audit_log_resource_idx
    on public.audit_log (resource_type, resource_id);

-- actor_id is ON DELETE SET NULL, not CASCADE, deliberately: deleting a user
-- must not erase the record of what they did. That is the entire point of an
-- audit trail.
alter table public.audit_log enable row level security;

-- ── stripe_events ───────────────────────────────────────────────────────────
create table if not exists public.stripe_events (
    event_id      text primary key,
    event_type    text,
    processed_at  timestamptz default now()
);

-- The primary key IS the control. app/api/payments_stripe.py claims the event
-- id BEFORE dispatching side effects, so a replayed webhook loses the insert
-- race and is dropped — which is what stops a redelivered event regressing a
-- fully_released payment back to paid_full.
alter table public.stripe_events enable row level security;

comment on table public.stripe_events is
    'Stripe webhook idempotency ledger. Claim-first: the insert must happen '
    'before any side effect. Backfilled into the migration pipeline 2026-08-19 '
    '(SB-0044) — it previously existed only in docs/.';
