-- 20260725210000_google_business_reviews_import.sql
--
-- LANE D — WALKTHROUGH M3, 2026-07-25
-- "Import verified Google reviews at business signup: connect Google account,
--  pull curated verified reviews so nobody starts at zero."
--
-- Backs backend/app/api/google_reviews.py.
--
-- BUILT DARK. The Google Business Profile API is gated behind a manual Google
-- approval that has NOT been granted. Every write path in the API module is
-- behind the GOOGLE_REVIEWS_ENABLED env flag (default OFF), so these tables
-- ship empty and stay empty until the flag flips. Nothing here seeds, fakes,
-- or backfills a single review — a row in business_imported_reviews can only
-- come from an OAuth-authenticated pull against a location the connected
-- Google account actually owns.
--
-- WHY NOT REUSE public.reviews
-- ----------------------------
-- Verified against the live database (project ulnxapnsenzyddddldjt) on
-- 2026-07-25 — docs/swingby_database_schema.md is stale, this is the real shape:
--
--   reviews: id, booking_id -> bookings.id, reviewer_id -> users.id,
--            reviewee_id, reviewee_type, rating, comment, created_at
--
-- An imported Google review has NO SwingBy booking and NO SwingBy reviewer, so
-- it cannot satisfy either foreign key without making both nullable — which
-- would weaken the integrity of every native review to accommodate a foreign
-- one. Worse, reviews.rating feeds the businesses.avg_rating / review_count
-- recalculation in backend/app/api/reviews.py; dropping imported rows in there
-- would silently blend "5 stars from a job SwingBy escrowed and completed" with
-- "5 stars from somewhere else entirely" behind a single number.
--
-- A separate table makes the distinction STRUCTURAL rather than a flag someone
-- can forget to filter on. Native trust stays native; imported trust is shown,
-- labelled, and never laundered into the SwingBy rating.
--
-- Everything here is ADDITIVE: three new tables, no alters, no drops. Safe to
-- re-run — every statement uses an "if not exists" / "if exists" idiom.
--
-- RLS posture matches supabase/migrations/20260724090000_*.sql:
--   anon          → zero access
--   authenticated → SELECT only, and only what they are entitled to
--   service_role  → full access (every backend write goes through service_role)

begin;

-- ---------------------------------------------------------------------------
-- 1. business_google_connections — the owner's Google Business Profile link
-- ---------------------------------------------------------------------------
-- One connection per business (PK on business_id). Reconnecting REPLACES.
--
-- SECURITY: this table holds OAuth tokens. It has NO policy for `authenticated`
-- at all — not even SELECT — so the only way to read a token is the
-- service_role key, which lives on the backend and is never shipped to a
-- client (CLAUDE.md: "service_role key backend-only"). The mobile app learns
-- connection state from GET /google-reviews/status, which returns the account
-- email and never the tokens.
create table if not exists public.business_google_connections (
    business_id         uuid primary key
                          references public.businesses(id) on delete cascade,
    connected_by        uuid not null references public.users(id) on delete restrict,
    google_account_id   text,
    google_account_email text,
    access_token        text,
    refresh_token       text,
    token_expires_at    timestamptz,
    scopes              text not null default '',
    status              text not null default 'connected'
                          check (status in ('connected', 'needs_reauth', 'revoked')),
    selected_location   text,
    selected_location_title text,
    last_import_at      timestamptz,
    last_import_error   text,
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

comment on table public.business_google_connections is
  'Google Business Profile OAuth link for one business. Separate consent from sign-in OAuth (app/api/auth.py) — different scopes (business.manage), different grant. Holds tokens: service_role only, no authenticated policy exists on purpose.';

comment on column public.business_google_connections.selected_location is
  'Google Business Profile resource name of the location whose reviews are imported, e.g. "accounts/123/locations/456". Null until the owner picks one.';

comment on column public.business_google_connections.status is
  'connected = tokens usable. needs_reauth = refresh failed / consent withdrawn at Google, owner must reconnect. revoked = owner disconnected from SwingBy.';

alter table public.business_google_connections enable row level security;

-- No authenticated policy. Deliberate — see the table comment. Any existing
-- one from an earlier hand-run is dropped so the posture cannot drift.
drop policy if exists "business_google_connections_select_owner"
  on public.business_google_connections;

-- ---------------------------------------------------------------------------
-- 2. business_google_oauth_states — one-shot CSRF + PKCE state
-- ---------------------------------------------------------------------------
-- The connect flow is a public-client PKCE round trip (same shape as the
-- social sign-in flow in app/api/auth.py). The verifier must survive the trip
-- to Google and back but must NEVER travel with the code, so it is parked here
-- keyed by the opaque `state` and consumed exactly once.
--
-- `used_at` is what makes it one-shot: a replayed callback finds a row that is
-- already spent and is rejected, so an intercepted redirect cannot be cashed
-- in twice.
create table if not exists public.business_google_oauth_states (
    state          text primary key,
    business_id    uuid not null references public.businesses(id) on delete cascade,
    user_id        uuid not null references public.users(id) on delete cascade,
    code_verifier  text not null,
    redirect_uri   text not null,
    app_redirect   text,
    created_at     timestamptz not null default now(),
    expires_at     timestamptz not null default (now() + interval '15 minutes'),
    used_at        timestamptz
);

create index if not exists business_google_oauth_states_expires_idx
    on public.business_google_oauth_states (expires_at);

comment on table public.business_google_oauth_states is
  'One-shot PKCE/CSRF state for the Google Business Profile connect flow. Rows expire after 15 minutes and are consumed once (used_at). Safe to hard-delete anything past expires_at.';

alter table public.business_google_oauth_states enable row level security;
-- No policies at all: service_role only. A client never reads this table.

-- ---------------------------------------------------------------------------
-- 3. business_imported_reviews — the imported, provenance-tagged reviews
-- ---------------------------------------------------------------------------
-- PROVENANCE IS THE POINT. Every row carries where it came from (`source`),
-- which location it was pulled from (`external_location`), the platform's own
-- id for it (`external_review_id`), and `verified` — which is true ONLY
-- because the row was written during an OAuth-authenticated pull from a
-- location the connected Google account is an owner/manager of. There is no
-- other writer. Nothing in this schema or in the API can mint a `verified` row
-- from user input, and nothing scrapes: reviews arrive over the Business
-- Profile API or they do not arrive.
--
-- IDEMPOTENCY: UNIQUE (business_id, source, external_review_id). Re-importing
-- the same location updates the existing rows in place (rating/text/edit time)
-- and never duplicates. That constraint is the product rule, not hygiene —
-- an owner will hit "Import" more than once.
create table if not exists public.business_imported_reviews (
    id                 uuid primary key default gen_random_uuid(),
    business_id        uuid not null
                         references public.businesses(id) on delete cascade,
    source             text not null default 'google'
                         check (source in ('google')),
    external_review_id text not null,
    external_location  text,
    author_name        text not null default '',
    author_photo_url   text,
    rating             integer not null check (rating between 1 and 5),
    comment            text,
    reviewed_at        timestamptz,
    review_updated_at  timestamptz,
    verified           boolean not null default true,
    imported_by        uuid references public.users(id) on delete set null,
    imported_at        timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    constraint business_imported_reviews_unique_external
      unique (business_id, source, external_review_id)
);

create index if not exists business_imported_reviews_business_idx
    on public.business_imported_reviews (business_id, reviewed_at desc);

comment on table public.business_imported_reviews is
  'Reviews imported from a business owner''s OWN external profile (Google Business Profile today). Deliberately NOT public.reviews: these have no SwingBy booking and no SwingBy reviewer, and they must never be blended into businesses.avg_rating. Shown to clients labelled as imported-and-verified, always distinguishable from a native SwingBy review.';

comment on column public.business_imported_reviews.verified is
  'True only because the row was written by an OAuth-authenticated import from a location the connected Google account owns. Never set from user input. If it is ever false, do not present the row as verified.';

comment on column public.business_imported_reviews.external_review_id is
  'The platform''s own id for the review (Google: reviews[].reviewId). Half of the idempotency key — re-import updates, never duplicates.';

alter table public.business_imported_reviews enable row level security;

-- Imported reviews are shown on the public business profile, so any signed-in
-- user may read them. They are, by construction, already public on Google.
drop policy if exists "business_imported_reviews_select_all"
  on public.business_imported_reviews;
create policy "business_imported_reviews_select_all"
  on public.business_imported_reviews
    for select
    to authenticated
    using (true);

-- Writes are service_role only — no insert/update/delete policy for
-- `authenticated` exists, so a client holding a user JWT cannot manufacture a
-- "verified" review even if it reached PostgREST directly.

commit;
