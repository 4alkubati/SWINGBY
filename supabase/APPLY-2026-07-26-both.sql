-- APPLY-2026-07-26-both.sql
-- Run this whole file once in the Supabase SQL Editor (project ulnxapnsenzyddddldjt).
-- Both migrations are additive and idempotent: safe to re-run, no drops, no backfill.
-- 1) businesses.logo_url        2) booking_locations (live provider position)

-- ===== 20260726120000_business_logo_url.sql =====
-- Business logo -- the missing visual identity.
--
-- `businesses` had 25 columns and not one of them was an image: no logo_url,
-- no avatar_url, no image_url. Clients have `users.avatar_url` and employees
-- render off the same column, so a business was the only entity in the product
-- with no face -- a name and a category in search results, on its own profile,
-- and on the home "Top rated near you" card.
--
-- One nullable text column, same contract as `users.avatar_url`: a public URL
-- into the existing public-read `job-photos` bucket, written by
-- POST /uploads/image. No new bucket, no new storage policy, no backfill.
--
-- NULL is the normal state, not an error state. Every surface that renders a
-- business falls back to the initials monogram tile (Avatar shape="tile",
-- accentMuted + accentText per POLISH-TIPS Sec.8), which is what all of them
-- already showed before this column existed. On the day this ships every row
-- is NULL, so the fallback is the common path and nothing about it is a
-- placeholder for a missing image.
--
-- Additive and idempotent: no default, no NOT NULL, no constraint on existing
-- rows, so this cannot fail on or rewrite the live table. The API tolerates the
-- column being absent (see backend/app/api/businesses.py::_strip_missing_logo_
-- column) so code and migration can land out of order without 500ing a signup.

alter table public.businesses
    add column if not exists logo_url text;

comment on column public.businesses.logo_url is
    'Public URL of the business logo in the job-photos bucket. NULL = render the initials monogram tile. Written only by the owning owner via PATCH /businesses/{id}.';

-- ===== 20260726130000_live_provider_location.sql =====
-- =============================================================================
-- 20260726130000_live_provider_location.sql
--
-- FILED, PENDING APPLY -- this has NOT been run against project
-- ulnxapnsenzyddddldjt. Apply in the Supabase SQL Editor (or `supabase db push`
-- once the CLI is linked). Same convention as
-- 20260725220000_owner_is_the_default_assignee.sql.
--
-- backend/app/api/booking_location.py is written to survive this table being
-- absent: every statement against `booking_locations` is wrapped, and a missing
-- table degrades to HTTP 200 with `available: false` / `location: null` rather
-- than a 500. The privacy gates do NOT depend on this table -- they are computed
-- from `booking_events`, which already exists -- so shipping the code ahead of
-- the migration is safe in both directions.
--
-- WALKTHROUGH M7 -- "'On my way' button for the business + live location on the
-- client's booking details while en route." The button half already shipped
-- (JobManagementScreen posts a booking_events row with event_type 'en_route').
-- The location half had nothing behind it anywhere in the repo: no table, no
-- endpoint, no client. This is that storage.
--
-- ---------------------------------------------------------------------------
-- WHY THERE IS NO TRAIL
-- ---------------------------------------------------------------------------
-- `booking_locations` is keyed by booking_id UNIQUE: at most ONE row per
-- booking, ever, and every push UPSERTs it in place. This is deliberate and it
-- is the most important line in the file.
--
-- A history table here would be a permanent, exportable, subpoena-able record
-- of where a worker physically drove, minute by minute, accumulating forever --
-- for a feature whose entire product value is the single word "now". The client
-- UI renders one dot. The second-most-recent position has never been displayed
-- and there is no roadmap item that would display it. Storing it would be
-- collecting sensitive personal data for no purpose, which is exactly the
-- failure mode the walkthrough's worst finding (L3, client home photos leaking)
-- was an instance of.
--
-- Rows are also actively removed, not merely overwritten: the backend deletes
-- the row when the sharing window closes (explicit DELETE /bookings/{id}/location,
-- and lazily on the first read after arrival/start/completion/cancellation). The
-- steady state between jobs is zero rows. `on delete cascade` from bookings
-- means deleting a booking takes its last known position with it, so the
-- web-only true-delete path needs no extra clause for this table.
--
-- ---------------------------------------------------------------------------
-- DIRECTION
-- ---------------------------------------------------------------------------
-- provider_id is NOT NULL. Only a provider ever writes a row, so there is no
-- representable state in which this table holds a CLIENT's position. That is
-- enforced in the API (only a business owner / assigned employee may PUT) and
-- the schema simply cannot express the reverse.
--
-- Everything here is ADDITIVE and idempotent: one new table, no drops, no type
-- changes, safe to re-run.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. booking_locations -- the provider's LATEST position, and only the latest
-- ---------------------------------------------------------------------------
create table if not exists public.booking_locations (
    booking_id   uuid primary key
                   references public.bookings(id) on delete cascade,
    provider_id  uuid not null references public.users(id) on delete cascade,
    lat          double precision not null check (lat  between -90  and 90),
    lng          double precision not null check (lng  between -180 and 180),
    -- Everything the OS hands us for free, all nullable: a fix with no accuracy
    -- reading is still a usable fix and must not be rejected.
    accuracy_m   double precision check (accuracy_m >= 0),
    heading      double precision check (heading >= 0 and heading < 360),
    speed_mps    double precision check (speed_mps >= 0),
    updated_at   timestamptz not null default now()
);

comment on table public.booking_locations is
  'Live provider position while en route (walkthrough M7). AT MOST ONE ROW PER BOOKING -- every push upserts in place and there is deliberately no history table: the client renders one dot labelled with its age, and a trail of where a worker drove would be sensitive personal data collected for no product purpose. The backend deletes the row the moment the booking leaves the en_route window.';

comment on column public.booking_locations.provider_id is
  'The business owner or assigned employee who pushed this fix. NOT NULL: location flows provider -> client only, and this table can never hold a client position.';

comment on column public.booking_locations.updated_at is
  'Set by the backend on every push. The client renders an honest "last updated" from this, and treats a fix older than 120 s as stale rather than pretending the dot is live.';

-- The only read pattern is "the row for this booking", already served by the
-- primary key. This index exists solely so an operator can answer "is anything
-- being broadcast right now / is anything stuck" without a seq scan.
create index if not exists booking_locations_updated_at_idx
    on public.booking_locations (updated_at desc);

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------
-- Posture matches docs/rls_policies.sql and the other booking-child tables:
--   anon          -> zero access
--   authenticated -> SELECT only, and only the two principals below
--   service_role  -> full access (all backend writes go through service_role)
--
-- Note this policy is STRICTER than the sibling booking_voice_notes /
-- booking_proofs policies, which let any party to the booking read. Here the
-- business owner is NOT granted a blanket read of an employee's live position:
-- the recipient of this feed is the client, plus the provider reading their own
-- row back. The API enforces the same rule (a provider party who did not write
-- the row gets `sharing: false`, not coordinates), so the two layers agree.
alter table public.booking_locations enable row level security;

drop policy if exists "booking_locations_select_client_or_self"
    on public.booking_locations;
create policy "booking_locations_select_client_or_self" on public.booking_locations
    for select
    to authenticated
    using (
        booking_locations.provider_id = auth.uid()
        or exists (
            select 1
            from public.bookings b
            where b.id = booking_locations.booking_id
              and b.client_id = auth.uid()
        )
    );

-- No INSERT / UPDATE / DELETE policy for `authenticated` on purpose: writes are
-- service_role only, so a client can never author or tamper with a position row
-- even if a token leaks into a frontend.

commit;
