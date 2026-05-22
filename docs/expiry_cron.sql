-- =============================================================================
-- SwingBy — Service Post Auto-Expiry
-- Run this in the Supabase SQL Editor.
--
-- Requires the pg_cron extension (enabled by default on Supabase).
-- This marks any open service_post as 'expired' once its expires_at passes.
-- =============================================================================


-- ── 1. Enable pg_cron (if not already enabled) ───────────────────────────────
create extension if not exists pg_cron;


-- ── 2. Function that does the expiry ─────────────────────────────────────────
create or replace function expire_old_service_posts()
returns void
language plpgsql
security definer   -- runs as DB owner, bypasses RLS
as $$
begin
    update service_posts
    set    status = 'expired'
    where  status = 'open'
    and    expires_at < now();
end;
$$;


-- ── 3. Schedule: run every hour ──────────────────────────────────────────────
-- Removes any old version of the job first (idempotent re-runs)
select cron.unschedule('expire-service-posts')
where exists (
    select 1 from cron.job where jobname = 'expire-service-posts'
);

select cron.schedule(
    'expire-service-posts',   -- job name
    '0 * * * *',              -- every hour on the hour
    $$select expire_old_service_posts();$$
);


-- ── Verify the job was created ────────────────────────────────────────────────
select * from cron.job where jobname = 'expire-service-posts';
