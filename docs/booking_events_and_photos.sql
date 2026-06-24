-- =============================================================================
-- SwingBy — Live Job Status (booking_events) + Before/After photos (booking_photos)
-- Run once in the Supabase SQL Editor, or apply via MCP `apply_migration`.
--
-- Tables added (additive only — no destructive change):
--   public.booking_events  — append-only timeline for Live Job Status
--   public.booking_photos  — before/after proof-of-work attachments
--
-- RLS rule of thumb (same as docs/rls_policies.sql):
--   anon          → zero access
--   authenticated → SELECT only when they are a party to the booking
--   service_role  → full access (backend writes always go through service role)
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- BOOKING_EVENTS — append-only Live Job Status timeline
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.booking_events (
    id          uuid primary key default gen_random_uuid(),
    booking_id  uuid not null references public.bookings(id) on delete cascade,
    actor_id    uuid not null references public.users(id) on delete restrict,
    event_type  text not null check (event_type in (
        'en_route',
        'arrived',
        'started',
        'paused',
        'resumed',
        'completed',
        'cancelled_event'
    )),
    note        text,
    lat         double precision,
    lng         double precision,
    created_at  timestamptz not null default now()
);

create index if not exists booking_events_booking_id_created_at_idx
    on public.booking_events (booking_id, created_at);

alter table public.booking_events enable row level security;

drop policy if exists "booking_events_select_party" on public.booking_events;

-- Authenticated user may read events for a booking they are a party to:
--   - client  on the booking
--   - owner   of the business on the booking
--   - employee assigned to the booking
create policy "booking_events_select_party" on public.booking_events
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.bookings b
            left join public.businesses bz on bz.id = b.business_id
            left join public.employees e   on e.id = b.employee_id
            where b.id = booking_events.booking_id
              and (
                  b.client_id  = auth.uid()
                  or bz.owner_id = auth.uid()
                  or e.user_id   = auth.uid()
              )
        )
    );

-- INSERT / UPDATE / DELETE intentionally not exposed to authenticated.
-- Backend writes always go through service_role which bypasses RLS.


-- ─────────────────────────────────────────────────────────────────────────────
-- BOOKING_PHOTOS — before/after proof-of-work attachments
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.booking_photos (
    id            uuid primary key default gen_random_uuid(),
    booking_id    uuid not null references public.bookings(id) on delete cascade,
    uploaded_by   uuid not null references public.users(id) on delete restrict,
    phase         text not null check (phase in ('before', 'after')),
    url           text not null,
    path          text not null,
    caption       text,
    created_at    timestamptz not null default now()
);

create index if not exists booking_photos_booking_id_phase_idx
    on public.booking_photos (booking_id, phase, created_at);

alter table public.booking_photos enable row level security;

drop policy if exists "booking_photos_select_party" on public.booking_photos;

create policy "booking_photos_select_party" on public.booking_photos
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.bookings b
            left join public.businesses bz on bz.id = b.business_id
            left join public.employees e   on e.id = b.employee_id
            where b.id = booking_photos.booking_id
              and (
                  b.client_id  = auth.uid()
                  or bz.owner_id = auth.uid()
                  or e.user_id   = auth.uid()
              )
        )
    );

-- INSERT/UPDATE/DELETE: service_role only (backend mediates).


-- ─────────────────────────────────────────────────────────────────────────────
-- Sanity check (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- select 'booking_events' as table, count(*) from public.booking_events
-- union all
-- select 'booking_photos', count(*) from public.booking_photos;
