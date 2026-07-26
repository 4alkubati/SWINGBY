-- SwingBy - apply ALL THREE migrations, in this order.
-- Project: ulnxapnsenzyddddldjt
-- Source: integrate/lanes-2026-07-25 @ 1255ddd
--
-- HOW: Supabase Dashboard -> SQL Editor -> New query -> select ALL of this
-- file's contents -> paste -> Run. Do not paste the filename. Paste the file.
--
-- ALL ADDITIVE: no drops, no truncates, no column retypes.
-- Safe to re-run: every statement is if-not-exists / on-conflict guarded.

-- ===================================================================
-- FILE: 20260725210000_google_business_reviews_import.sql
-- ===================================================================
-- 20260725210000_google_business_reviews_import.sql
--
-- LANE D -- WALKTHROUGH M3, 2026-07-25
-- "Import verified Google reviews at business signup: connect Google account,
--  pull curated verified reviews so nobody starts at zero."
--
-- Backs backend/app/api/google_reviews.py.
--
-- BUILT DARK. The Google Business Profile API is gated behind a manual Google
-- approval that has NOT been granted. Every write path in the API module is
-- behind the GOOGLE_REVIEWS_ENABLED env flag (default OFF), so these tables
-- ship empty and stay empty until the flag flips. Nothing here seeds, fakes,
-- or backfills a single review -- a row in business_imported_reviews can only
-- come from an OAuth-authenticated pull against a location the connected
-- Google account actually owns.
--
-- WHY NOT REUSE public.reviews
-- ----------------------------
-- Verified against the live database (project ulnxapnsenzyddddldjt) on
-- 2026-07-25 -- docs/swingby_database_schema.md is stale, this is the real shape:
--
--   reviews: id, booking_id -> bookings.id, reviewer_id -> users.id,
--            reviewee_id, reviewee_type, rating, comment, created_at
--
-- An imported Google review has NO SwingBy booking and NO SwingBy reviewer, so
-- it cannot satisfy either foreign key without making both nullable -- which
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
-- re-run -- every statement uses an "if not exists" / "if exists" idiom.
--
-- RLS posture matches supabase/migrations/20260724090000_*.sql:
--   anon          -> zero access
--   authenticated -> SELECT only, and only what they are entitled to
--   service_role  -> full access (every backend write goes through service_role)

begin;

-- ---------------------------------------------------------------------------
-- 1. business_google_connections -- the owner's Google Business Profile link
-- ---------------------------------------------------------------------------
-- One connection per business (PK on business_id). Reconnecting REPLACES.
--
-- SECURITY: this table holds OAuth tokens. It has NO policy for `authenticated`
-- at all -- not even SELECT -- so the only way to read a token is the
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
  'Google Business Profile OAuth link for one business. Separate consent from sign-in OAuth (app/api/auth.py) -- different scopes (business.manage), different grant. Holds tokens: service_role only, no authenticated policy exists on purpose.';

comment on column public.business_google_connections.selected_location is
  'Google Business Profile resource name of the location whose reviews are imported, e.g. "accounts/123/locations/456". Null until the owner picks one.';

comment on column public.business_google_connections.status is
  'connected = tokens usable. needs_reauth = refresh failed / consent withdrawn at Google, owner must reconnect. revoked = owner disconnected from SwingBy.';

alter table public.business_google_connections enable row level security;

-- No authenticated policy. Deliberate -- see the table comment. Any existing
-- one from an earlier hand-run is dropped so the posture cannot drift.
drop policy if exists "business_google_connections_select_owner"
  on public.business_google_connections;

-- ---------------------------------------------------------------------------
-- 2. business_google_oauth_states -- one-shot CSRF + PKCE state
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
-- 3. business_imported_reviews -- the imported, provenance-tagged reviews
-- ---------------------------------------------------------------------------
-- PROVENANCE IS THE POINT. Every row carries where it came from (`source`),
-- which location it was pulled from (`external_location`), the platform's own
-- id for it (`external_review_id`), and `verified` -- which is true ONLY
-- because the row was written during an OAuth-authenticated pull from a
-- location the connected Google account is an owner/manager of. There is no
-- other writer. Nothing in this schema or in the API can mint a `verified` row
-- from user input, and nothing scrapes: reviews arrive over the Business
-- Profile API or they do not arrive.
--
-- IDEMPOTENCY: UNIQUE (business_id, source, external_review_id). Re-importing
-- the same location updates the existing rows in place (rating/text/edit time)
-- and never duplicates. That constraint is the product rule, not hygiene --
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
  'The platform''s own id for the review (Google: reviews[].reviewId). Half of the idempotency key -- re-import updates, never duplicates.';

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

-- Writes are service_role only -- no insert/update/delete policy for
-- `authenticated` exists, so a client holding a user JWT cannot manufacture a
-- "verified" review even if it reached PostgREST directly.

commit;


-- ===================================================================
-- FILE: 20260725220000_owner_is_the_default_assignee.sql
-- ===================================================================
-- =============================================================================
-- 20260725220000_owner_is_the_default_assignee.sql
--
-- FILED, PENDING APPLY -- no live Supabase credentials were available in this
-- worktree, so this has NOT been run against project ulnxapnsenzyddddldjt.
-- Apply in the Supabase SQL Editor (or `supabase db push` once the CLI is
-- linked). Same convention as 20260720000000_s1_column_lockdown...sql.
--
-- WALKTHROUGH M8 -- "owner is the default assignee (never 'No active employees
-- found')".
--
-- THE BUG the founder hit: `employees` rows are only ever created by
-- POST /employees/ (backend/app/api/employees.py), which invites a NEW person
-- with their own auth account. The person who registered the business is never
-- in that table. So for a solo operator -- the overwhelmingly common case at
-- launch -- `GET /employees/` returns [], the assign picker rendered the literal
-- dead end "No active employees found.", and the job could never be assigned to
-- anyone at all, including the person who was actually going to do it.
--
-- THE MODEL: the owner IS an assignee. They get a real `employees` row with
-- role_title 'Owner'. Chosen over the alternatives because every downstream
-- join keeps working with zero changes:
--   bookings.employee_id -> employees -> users   (booking reads, M8's name +
--                                                 jobs-completed + tenure)
--   invoices.py "Service delivered by ..."
--   proof_of_work.py's assigned-employee provider check
--   employees.py GET /{id}/profile (jobs_completed, tenure) -- already correct
-- A sentinel employee_id, or a nullable "assigned to owner" flag, would have
-- required touching each of those read paths and would have left every one of
-- them with a null-employee branch to get wrong.
--
-- The owner's `users.role` is deliberately NOT changed -- they stay
-- 'business_owner' (their whole auth/routing surface keys off it). An
-- `employees` row is a STAFFING record, not an account role.
--
-- Everything here is ADDITIVE and idempotent: no drops, no type changes, safe
-- to re-run. The backend also creates this row lazily on first use
-- (bookings.py::_ensure_owner_employee), so a business registered AFTER this
-- migration runs is covered too -- the backfill below is for the ones that
-- already exist.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- PART 1 -- one owner row per existing business, where missing
-- ---------------------------------------------------------------------------
-- `not exists` makes this re-runnable and means a business whose owner already
-- happens to have an employees row (e.g. they invited themselves by email) is
-- left completely alone -- including their chosen role_title.
insert into public.employees (business_id, user_id, role_title, is_active)
select b.id, b.owner_id, 'Owner', true
from public.businesses b
where b.owner_id is not null
  and not exists (
    select 1
    from public.employees e
    where e.business_id = b.id
      and e.user_id = b.owner_id
  );

-- ---------------------------------------------------------------------------
-- PART 2 -- one employees row per (business, person)
-- ---------------------------------------------------------------------------
-- _ensure_owner_employee() is a read-then-insert, so two concurrent requests
-- on a business that has never assigned anyone could both miss and both insert.
-- This index makes the loser fail instead of creating a duplicate owner (the
-- backend catches that failure and re-reads).
--
-- Guarded rather than applied unconditionally: adding a UNIQUE index to a table
-- that already contains duplicates fails outright and would abort the whole
-- migration, and there was no live DB here to pre-flight it against. If dupes
-- exist the index is skipped with a NOTICE naming them, and PART 1 above has
-- still done its job.
do $$
declare
  dupes int;
begin
  select count(*) into dupes from (
    select business_id, user_id
    from public.employees
    where user_id is not null
    group by business_id, user_id
    having count(*) > 1
  ) d;

  if dupes > 0 then
    raise notice
      'employees_business_user_uniq SKIPPED: % (business_id, user_id) pair(s) are duplicated. Deduplicate, then re-run this migration.',
      dupes;
  else
    create unique index if not exists employees_business_user_uniq
      on public.employees (business_id, user_id);
    -- Inside the branch: COMMENT ON a non-existent index is a hard error, and
    -- the index does not exist on the skip path above.
    comment on index public.employees_business_user_uniq is
      'One staffing row per person per business. Also makes the owner-row get-or-create in bookings.py::_ensure_owner_employee race-safe.';
  end if;
end $$;

commit;


-- ===================================================================
-- FILE: 20260725230000_thread_attachments_and_terms.sql
-- ===================================================================
-- 20260725230000_thread_attachments_and_terms.sql
--
-- LANE B -- walkthrough item M11, 2026-07-25
-- "Share photos / agree to terms inside the message thread -- the thread is
--  currently text-only."
--
-- Two things the thread cannot carry today:
--
--   1. PHOTOS. `messages` has exactly one payload column (`content`, text), so
--      a client asking "is THIS the pipe you meant?" has to describe it. The
--      upload path already exists (POST /uploads/image -> bucket `job-photos`);
--      what is missing is a typed message row that points at the uploaded
--      object.
--
--   2. AN AGREEMENT. Businesses already type scope-of-work into the chat as
--      free text ("2 coats, we move the furniture, no drywall repair"). Free
--      text is not an agreement: nobody can later say WHO agreed, to exactly
--      WHAT wording, or WHEN -- and either party can claim the other edited it.
--      `message_terms` below is that record, and it is deliberately harder to
--      change than anything else in this schema.
--
-- Everything here is ADDITIVE: new nullable columns with defaults on
-- `messages`, one new table, no type changes, no drops. Every statement is
-- re-runnable ("if not exists" / "drop ... if exists" idiom).
--
-- RLS posture matches docs/rls_policies.sql and the 20260724090000 migration:
--   anon          -> zero access
--   authenticated -> SELECT only when they are a party to the thread
--   service_role  -> full access (all backend writes go through service_role)
--
-- PRIVACY NOTE (walkthrough audit L3 -- "client photos are a burglary recon
-- tool"): nothing here widens who can read a thread. A thread image is only
-- discoverable through GET /messages/{booking_id} or /messages/interest/{id},
-- both of which already gate on participation (_assert_message_access /
-- _assert_interest_access). See the comment on messages.attachment_path for
-- why the storage path -- not just the URL -- is persisted.

begin;

-- ---------------------------------------------------------------------------
-- 1. messages.message_type -- text | image | terms
-- ---------------------------------------------------------------------------
-- Existing rows are all plain chat, and the default backfills them as 'text'
-- without a rewrite of the payload column.
alter table public.messages
  add column if not exists message_type text not null default 'text';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_message_type_check'
  ) then
    alter table public.messages
      add constraint messages_message_type_check
      check (message_type in ('text', 'image', 'terms'));
  end if;
end $$;

comment on column public.messages.message_type is
  'text = ordinary chat. image = a photo shared in the thread (attachment_* columns carry it; content holds the caption / list preview). terms = a scope-of-work proposal whose authoritative wording and acceptance record live in public.message_terms.';

-- ---------------------------------------------------------------------------
-- 2. messages.attachment_* -- the photo
-- ---------------------------------------------------------------------------
-- url  : what the app renders today.
-- path : the storage object key, kept SEPARATELY on purpose. Reads re-derive
--        the viewable URL from `path` at request time rather than trusting the
--        URL frozen at write time (backend/app/api/messages.py::_attachment_url).
--        That is the same discipline uploads.sign_audio_path uses for private
--        voice notes, and it is what makes flipping thread photos onto a
--        private bucket later a one-function change instead of a data
--        migration over every historical row.
-- width/height: expo-image-picker hands these back for free; storing them lets
--        the bubble reserve its aspect ratio so the thread does not jump when
--        the image decodes (POLISH-TIPS ?7 -- never animate layout on refresh).
alter table public.messages
  add column if not exists attachment_url    text;
alter table public.messages
  add column if not exists attachment_path   text;
alter table public.messages
  add column if not exists attachment_width  integer;
alter table public.messages
  add column if not exists attachment_height integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_attachment_check'
  ) then
    alter table public.messages
      add constraint messages_attachment_check
      check (
        message_type <> 'image'
        or (attachment_url is not null and attachment_path is not null)
      );
  end if;
end $$;

comment on column public.messages.attachment_path is
  'Storage object key inside the images bucket. Persisted alongside the URL so every read can re-derive a viewable link (and so a future move to a private bucket + per-read signed URLs needs no data migration).';

-- ---------------------------------------------------------------------------
-- 3. message_terms -- the in-thread agreement
-- ---------------------------------------------------------------------------
-- One row per 'terms' message. The row is the legal artefact, so it answers all
-- three questions on its own:
--
--   WHO   proposed_by / accepted_by  (+ accepted_name: the name shown on the
--         card at the moment of acceptance, so a later profile rename cannot
--         quietly restate who signed)
--   WHAT  title + terms_text, verbatim, exactly as rendered in the bubble
--   WHEN  created_at / accepted_at
--
-- TAMPER EVIDENCE. Two chained SHA-256 fingerprints, both computed by the API
-- (backend/app/api/messages.py::_terms_fingerprint / _acceptance_fingerprint):
--
--   terms_hash      = sha256("swingby-terms-v1" | message_id | proposed_by
--                            | title | terms_text)
--   acceptance_hash = sha256("swingby-terms-accept-v1" | terms_hash
--                            | accepted_by | accepted_at)
--
-- Because acceptance_hash is computed OVER terms_hash, editing a single
-- character of the agreed wording invalidates both links at once. Every read
-- recomputes them and returns `verified`; the app shows an unverifiable record
-- as broken rather than rendering it as a valid agreement.
--
-- IMMUTABILITY. Hashes alone only detect edits. The trigger in ?4 refuses
-- them -- and unlike RLS, triggers also bind service_role, i.e. the backend's
-- own key. There is no supported path, from the API or the SQL editor, that
-- rewrites the wording of an agreement or re-writes who accepted it.
create table if not exists public.message_terms (
    id              uuid primary key default gen_random_uuid(),
    message_id      uuid not null unique
                      references public.messages(id) on delete restrict,
    -- Thread keys are denormalised for RLS + lookup. Mirrors the messages
    -- table's own OR (not XOR) shape: accept_interest() stamps booking_id onto
    -- rows that already carry interest_id, so both can legitimately be set.
    booking_id      uuid references public.bookings(id) on delete restrict,
    interest_id     uuid references public.interests(id) on delete restrict,
    proposed_by     uuid not null references public.users(id) on delete restrict,
    title           text not null check (length(btrim(title)) > 0),
    terms_text      text not null check (length(btrim(terms_text)) > 0),
    terms_hash      text not null,
    status          text not null default 'pending'
                      check (status in ('pending', 'accepted', 'withdrawn')),
    created_at      timestamptz not null default now(),
    accepted_by     uuid references public.users(id) on delete restrict,
    accepted_at     timestamptz,
    accepted_name   text,
    acceptance_hash text,
    constraint message_terms_thread_check
      check (booking_id is not null or interest_id is not null),
    -- 'accepted' is all-or-nothing: a half-written acceptance is not a record.
    constraint message_terms_acceptance_complete_check
      check (
        (status = 'accepted') = (accepted_at is not null)
        and (accepted_at is null)
            = (accepted_by is null and acceptance_hash is null)
      )
);

comment on table public.message_terms is
  'In-thread scope-of-work agreement (walkthrough M11). Write-once: ?4 trigger blocks edits to the wording forever and blocks any change at all once accepted, for service_role too. Carries NO money -- price stays in the quote card / pay sheet so there is exactly one source of truth for what is charged (design/handoff-jet-pulse/PAYMENTS.md).';

create index if not exists message_terms_booking_idx
    on public.message_terms (booking_id);
create index if not exists message_terms_interest_idx
    on public.message_terms (interest_id);

alter table public.message_terms enable row level security;

drop policy if exists "message_terms_select_party" on public.message_terms;
create policy "message_terms_select_party" on public.message_terms
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.bookings b
            left join public.businesses bz on bz.id = b.business_id
            left join public.employees   e  on e.id = b.employee_id
            where b.id = message_terms.booking_id
              and (
                  b.client_id  = auth.uid()
                  or bz.owner_id = auth.uid()
                  or e.user_id   = auth.uid()
              )
        )
        or exists (
            select 1
            from public.interests i
            join public.service_posts sp on sp.id = i.post_id
            left join public.businesses bz2 on bz2.id = i.business_id
            where i.id = message_terms.interest_id
              and (
                  sp.client_id  = auth.uid()
                  or bz2.owner_id = auth.uid()
              )
        )
    );

-- ---------------------------------------------------------------------------
-- 4. The immutability trigger
-- ---------------------------------------------------------------------------
-- This is the teeth behind "agreed". Triggers are not bypassed by service_role
-- the way RLS is, so this binds the backend as hard as it binds anyone.
--
--   o the wording, its author and its fingerprint are write-once, forever;
--   o acceptance may be written exactly once (pending -> accepted) and never
--     amended, revoked or re-pointed at somebody else;
--   o 'withdrawn' is only reachable from 'pending' -- you cannot un-agree;
--   o an accepted agreement cannot be deleted.
create or replace function public.message_terms_write_once()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'DELETE' then
        if old.accepted_at is not null then
            raise exception
                'message_terms %: an accepted agreement cannot be deleted', old.id
                using errcode = 'restrict_violation';
        end if;
        return old;
    end if;

    if new.message_id  is distinct from old.message_id
       or new.booking_id  is distinct from old.booking_id
       or new.interest_id is distinct from old.interest_id
       or new.proposed_by is distinct from old.proposed_by
       or new.title       is distinct from old.title
       or new.terms_text  is distinct from old.terms_text
       or new.terms_hash  is distinct from old.terms_hash
       or new.created_at  is distinct from old.created_at then
        raise exception
            'message_terms %: the agreed wording is immutable', old.id
            using errcode = 'restrict_violation';
    end if;

    if old.accepted_at is not null
       and (new.accepted_at     is distinct from old.accepted_at
            or new.accepted_by  is distinct from old.accepted_by
            or new.accepted_name is distinct from old.accepted_name
            or new.acceptance_hash is distinct from old.acceptance_hash
            or new.status       is distinct from old.status) then
        raise exception
            'message_terms %: the acceptance record is write-once', old.id
            using errcode = 'restrict_violation';
    end if;

    if old.status <> 'pending' and new.status is distinct from old.status then
        raise exception
            'message_terms %: status % is terminal', old.id, old.status
            using errcode = 'restrict_violation';
    end if;

    return new;
end;
$$;

drop trigger if exists message_terms_write_once_trg on public.message_terms;
create trigger message_terms_write_once_trg
    before update or delete on public.message_terms
    for each row execute function public.message_terms_write_once();

commit;


