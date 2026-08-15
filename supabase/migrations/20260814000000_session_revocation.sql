-- D7.4 (was pentest C-01) — refresh-token replay, and sessions that outlive a
-- password change.
--
-- THE FINDING
-- -----------
-- Log in, refresh once with R0 (Supabase rotates, succeeds), wait 65 seconds,
-- then refresh again with the SAME OLD R0 — it succeeds again and issues a
-- fresh access token. `/auth/refresh` was a thin passthrough to
-- `supabase_auth.auth.refresh_session(...)` with no application-level record of
-- which refresh tokens had already been spent, and Supabase's own reuse
-- interval did not reject the replay. A stolen refresh token therefore grants
-- indefinite reissue, and there was no way to revoke a compromised session
-- short of disabling the whole account.
--
-- WHAT THIS MIGRATION ADDS
-- ------------------------
-- 1. `refresh_token_usage` — one row per refresh token the API has spent,
--    keyed by SHA-256 so the token itself is never stored. Reuse detection
--    reads this.
-- 2. `users.sessions_valid_after` — a revocation watermark. Any access token
--    issued before it is refused, and any refresh is refused, which is how a
--    detected replay (and a password change) kills live sessions immediately
--    instead of waiting out the ~1h access-token lifetime.
-- 3. A trigger on `auth.users` that stamps the watermark when — and ONLY
--    when — the password actually changes.
--
-- A NOTE ON WHAT THIS DELIBERATELY DOES NOT DO
-- --------------------------------------------
-- Sessions do not expire on their own. A signed-in user stays signed in until
-- they log out, exactly like every consumer app; the watermark is null for
-- everybody until something security-relevant happens to their account. The
-- product requirement here is explicit (Kira, 2026-08-14): "everyone should be
-- able to sign in then not sign out, like Instagram or any app, until they log
-- out" — and separately, on a password change, "they should expire". Both hold.

-- ── 1. Spent refresh tokens ────────────────────────────────────────────────

create table if not exists public.refresh_token_usage (
    -- SHA-256 of the refresh token. The token is never stored: this table is
    -- readable by the service role, and a table of live refresh tokens would
    -- be a worse liability than the bug it fixes.
    token_hash   text primary key,
    user_id      uuid not null references public.users(id) on delete cascade,
    -- When WE handed this token out (at login, or as the rotation product of
    -- an earlier refresh). This is what makes the watermark work across a
    -- password change: the user's pre-change tokens are older than the
    -- watermark and die, while the token their next login issues is newer and
    -- lives. Without it, stamping the watermark would refuse the victim's own
    -- fresh login for ever.
    issued_at    timestamptz not null default now(),
    -- When it was spent. NULL means "issued, not yet used". A second spend
    -- outside the grace window is the replay this table exists to catch.
    consumed_at  timestamptz
);

-- Reuse detection reads by hash (the primary key). This index serves the
-- pruning sweep and the per-user forensic question "what was issued, when".
create index if not exists refresh_token_usage_user_issued_idx
    on public.refresh_token_usage (user_id, issued_at desc);

comment on table public.refresh_token_usage is
    'D7.4 — SHA-256 of every refresh token the API has issued, with when it '
    'was issued and when it was spent. Drives replay detection and lets the '
    'sessions_valid_after watermark distinguish a pre-password-change token '
    'from the one the next login issues. Rows are pruned after 30 days; a '
    'token that reappears past the horizon is treated as unseen, which is safe '
    'because Supabase rejects tokens far younger than that on its own.';

alter table public.refresh_token_usage enable row level security;

-- No policies, deliberately. Only the service role (which bypasses RLS) may
-- touch this table; there is no legitimate client-side read of it, and an
-- overly clever policy is how a "locked down" table ends up readable.

-- ── 2. The revocation watermark ────────────────────────────────────────────

alter table public.users
    add column if not exists sessions_valid_after timestamptz;

comment on column public.users.sessions_valid_after is
    'D7.4 — access tokens issued (iat) before this instant are refused, and '
    'refresh is refused outright. NULL means "nothing has been revoked", which '
    'is the normal state: sessions never expire on their own. Set by the '
    'password-change trigger below and by refresh-replay detection in '
    'backend/app/services/session_security.py.';

-- ── 3. Stamp the watermark when the password changes ───────────────────────
--
-- The reset flow never reaches our backend: web/launch/src/pages/
-- ResetPassword.jsx calls supabase-js `updateUser` directly against Supabase,
-- so there is no application code path to hook. A trigger is the only place
-- that sees every password change — the web page, the Supabase dashboard, and
-- any in-app change screen built later — which is why this lives in the
-- database rather than in FastAPI.

create or replace function public.swingby_revoke_sessions_on_password_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    update public.users
       set sessions_valid_after = now()
     where id = new.id;
    return new;
end;
$$;

comment on function public.swingby_revoke_sessions_on_password_change() is
    'D7.4 — stamps users.sessions_valid_after so a password change kills every '
    'other live session. Guarded by a WHEN clause on the trigger: see below.';

drop trigger if exists swingby_password_change_revokes_sessions on auth.users;

-- THE `WHEN` CLAUSE IS LOAD-BEARING. `auth.users` is updated on ordinary
-- events — `last_sign_in_at` is written on every single login. Without the
-- guard this trigger would stamp the watermark on login, which would invalidate
-- the token that login just issued, and every user would be signed out on every
-- sign-in attempt. Narrow it to the one column that means "the password
-- actually changed".
create trigger swingby_password_change_revokes_sessions
    after update of encrypted_password on auth.users
    for each row
    when (old.encrypted_password is distinct from new.encrypted_password)
    execute function public.swingby_revoke_sessions_on_password_change();
