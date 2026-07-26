-- 20260725230000_thread_attachments_and_terms.sql
--
-- LANE B — walkthrough item M11, 2026-07-25
-- "Share photos / agree to terms inside the message thread — the thread is
--  currently text-only."
--
-- Two things the thread cannot carry today:
--
--   1. PHOTOS. `messages` has exactly one payload column (`content`, text), so
--      a client asking "is THIS the pipe you meant?" has to describe it. The
--      upload path already exists (POST /uploads/image → bucket `job-photos`);
--      what is missing is a typed message row that points at the uploaded
--      object.
--
--   2. AN AGREEMENT. Businesses already type scope-of-work into the chat as
--      free text ("2 coats, we move the furniture, no drywall repair"). Free
--      text is not an agreement: nobody can later say WHO agreed, to exactly
--      WHAT wording, or WHEN — and either party can claim the other edited it.
--      `message_terms` below is that record, and it is deliberately harder to
--      change than anything else in this schema.
--
-- Everything here is ADDITIVE: new nullable columns with defaults on
-- `messages`, one new table, no type changes, no drops. Every statement is
-- re-runnable ("if not exists" / "drop ... if exists" idiom).
--
-- RLS posture matches docs/rls_policies.sql and the 20260724090000 migration:
--   anon          → zero access
--   authenticated → SELECT only when they are a party to the thread
--   service_role  → full access (all backend writes go through service_role)
--
-- PRIVACY NOTE (walkthrough audit L3 — "client photos are a burglary recon
-- tool"): nothing here widens who can read a thread. A thread image is only
-- discoverable through GET /messages/{booking_id} or /messages/interest/{id},
-- both of which already gate on participation (_assert_message_access /
-- _assert_interest_access). See the comment on messages.attachment_path for
-- why the storage path — not just the URL — is persisted.

begin;

-- ---------------------------------------------------------------------------
-- 1. messages.message_type — text | image | terms
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
-- 2. messages.attachment_* — the photo
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
--        the image decodes (POLISH-TIPS §7 — never animate layout on refresh).
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
-- 3. message_terms — the in-thread agreement
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
-- IMMUTABILITY. Hashes alone only detect edits. The trigger in §4 refuses
-- them — and unlike RLS, triggers also bind service_role, i.e. the backend's
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
  'In-thread scope-of-work agreement (walkthrough M11). Write-once: §4 trigger blocks edits to the wording forever and blocks any change at all once accepted, for service_role too. Carries NO money — price stays in the quote card / pay sheet so there is exactly one source of truth for what is charged (design/handoff-jet-pulse/PAYMENTS.md).';

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
--   • the wording, its author and its fingerprint are write-once, forever;
--   • acceptance may be written exactly once (pending → accepted) and never
--     amended, revoked or re-pointed at somebody else;
--   • 'withdrawn' is only reachable from 'pending' — you cannot un-agree;
--   • an accepted agreement cannot be deleted.
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
