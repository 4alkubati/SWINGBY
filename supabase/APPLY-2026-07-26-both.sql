-- APPLY-2026-07-26-both.sql
-- Run once in the Supabase SQL Editor (project ulnxapnsenzyddddldjt).
-- Verified 2026-07-26: NEITHER of these exists in the live DB yet.
-- No overlap with APPLY-2026-07-25-all-three.sql (that one is already applied).
-- Additive and idempotent: no drops, no backfill, safe to re-run.
--
-- 1) businesses.logo_url  -- one nullable column, so a business can have a logo
-- 2) booking_locations    -- provider's CURRENT position while en route.
--                            One row per booking, upserted in place, deleted
--                            when sharing ends. No location history on purpose.

begin;

-- 1 ---------------------------------------------------------------------
alter table public.businesses
    add column if not exists logo_url text;

-- 2 ---------------------------------------------------------------------
create table if not exists public.booking_locations (
    booking_id   uuid primary key
                   references public.bookings(id) on delete cascade,
    provider_id  uuid not null references public.users(id) on delete cascade,
    lat          double precision not null check (lat between -90 and 90),
    lng          double precision not null check (lng between -180 and 180),
    accuracy_m   double precision check (accuracy_m >= 0),
    heading      double precision check (heading >= 0 and heading < 360),
    speed_mps    double precision check (speed_mps >= 0),
    updated_at   timestamptz not null default now()
);

create index if not exists booking_locations_updated_at_idx
    on public.booking_locations (updated_at desc);

alter table public.booking_locations enable row level security;

-- Readable only by the client on the booking, or the provider reading their
-- own row back. No insert/update/delete policy: writes are service_role only.
drop policy if exists "booking_locations_select_client_or_self"
    on public.booking_locations;
create policy "booking_locations_select_client_or_self" on public.booking_locations
    for select
    to authenticated
    using (
        booking_locations.provider_id = auth.uid()
        or exists (
            select 1 from public.bookings b
            where b.id = booking_locations.booking_id
              and b.client_id = auth.uid()
        )
    );

commit;
