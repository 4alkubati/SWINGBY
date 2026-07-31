-- 20260731090000_ugc_reports_and_blocks.sql
--
-- APP STORE GUIDELINE 1.2 — USER-GENERATED CONTENT, 2026-07-31
--
-- SwingBy carries user-generated content on six surfaces: chat messages, voice
-- notes, reviews, job posts, proof-of-work photos, and avatars. Apple will not
-- approve an app with UGC unless it ships FOUR things (Guideline 1.2):
--
--   (a) a method for filtering objectionable material
--   (b) a mechanism for users to flag objectionable content
--   (c) a mechanism for users to block abusive users
--   (d) published contact information so users can reach the developer
--
-- (a) is backend/app/services/content_moderation.py, (d) is a support address in
-- the app. This migration is the storage behind (b) and (c).
--
-- Everything here is ADDITIVE: two new tables, new nullable columns with
-- defaults, no type changes, no drops. Safe to re-run — every statement is
-- guarded by an "if not exists" / "if exists" idiom.
--
-- RLS posture matches docs/rls_policies.sql and the 2026-07-24 lane-5 migration:
--   anon          → zero access
--   authenticated → SELECT only their own rows
--   service_role  → full access (all backend writes go through service_role)

begin;

-- ---------------------------------------------------------------------------
-- 1. content_reports — the flag mechanism, 1.2(b)
-- ---------------------------------------------------------------------------
-- `reported_user_id` is DENORMALISED at write time. The admin queue's whole job
-- is "who keeps getting reported", and resolving the owning user of a message vs
-- a review vs a post vs a photo needs a different join per target_type. Fanning
-- those out per row is exactly the cost admin_dispute_queue (disputes.py:211)
-- was written to avoid, so the API resolves the owner once, on POST, and stores
-- it here.
--
-- `target_type` is a CHECK rather than a lookup table: the set is closed by the
-- product (it is the list of surfaces that can carry UGC) and a new value always
-- needs backend code to resolve its owner anyway, so a migration is the right
-- place to notice it.
create table if not exists public.content_reports (
    id               uuid primary key default gen_random_uuid(),
    reporter_id      uuid not null references public.users(id) on delete cascade,
    target_type      text not null
                       check (target_type in (
                         'message',
                         'review',
                         'service_post',
                         'business',
                         'user',
                         'booking_photo',
                         'voice_note'
                       )),
    target_id        uuid not null,
    -- Nullable: a target whose owner cannot be resolved (deleted row, race with
    -- a cascade) must still be reportable. A report the admin can read beats a
    -- 500 the reporter cannot get past.
    reported_user_id uuid references public.users(id) on delete set null,
    reason           text not null
                       check (reason in (
                         'spam',
                         'harassment',
                         'hate_speech',
                         'sexual_content',
                         'violence',
                         'scam_or_fraud',
                         'off_platform_solicitation',
                         'other'
                       )),
    details          text,
    status           text not null default 'open'
                       check (status in ('open', 'under_review', 'resolved', 'dismissed')),
    -- What the admin actually DID. 'none' is a real outcome (report reviewed,
    -- nothing wrong) and is distinct from a null on an unresolved row.
    action_taken     text
                       check (action_taken in (
                         'none',
                         'content_hidden',
                         'user_warned',
                         'user_suspended'
                       )),
    resolution_notes text,
    resolved_at      timestamptz,
    resolved_by      uuid references public.users(id) on delete set null,
    created_at       timestamptz not null default now(),
    constraint content_reports_no_self_report check (reporter_id <> reported_user_id)
);

comment on table public.content_reports is
  'Guideline 1.2(b) flag mechanism. reported_user_id is denormalised at write time so the admin queue never fans out one owner lookup per row.';

-- One OPEN report per reporter per target. Re-reporting the same thing while a
-- decision is pending is noise; re-reporting after a dismissal is legitimate
-- (the content may have changed), which is why the index is partial rather than
-- a plain unique constraint.
create unique index if not exists content_reports_one_open_per_reporter_idx
    on public.content_reports (reporter_id, target_type, target_id)
    where status in ('open', 'under_review');

-- The admin queue reads exactly this: unresolved, newest first.
create index if not exists content_reports_status_created_idx
    on public.content_reports (status, created_at desc);

-- "How many times has this user been reported" — the signal an admin acts on.
create index if not exists content_reports_reported_user_idx
    on public.content_reports (reported_user_id)
    where reported_user_id is not null;

alter table public.content_reports enable row level security;

drop policy if exists "content_reports_select_own" on public.content_reports;
create policy "content_reports_select_own" on public.content_reports
    for select
    to authenticated
    using (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. user_blocks — the block mechanism, 1.2(c)
-- ---------------------------------------------------------------------------
-- Blocking is stored ONE-WAY (blocker → blocked) but ENFORCED SYMMETRICALLY in
-- backend/app/services/visibility.py::blocked_pair_ids. Storing it one-way keeps
-- "who did I block" (the Settings → Safety list) a trivial query; enforcing it
-- symmetrically is what 1.2(c) actually asks for — a one-way block would leave
-- the abuser free to keep initiating contact, which is the behaviour being
-- blocked in the first place.
create table if not exists public.user_blocks (
    id         uuid primary key default gen_random_uuid(),
    blocker_id uuid not null references public.users(id) on delete cascade,
    blocked_id uuid not null references public.users(id) on delete cascade,
    -- Optional free-text; the block is valid without one.
    reason     text,
    created_at timestamptz not null default now(),
    constraint user_blocks_unique_pair unique (blocker_id, blocked_id),
    constraint user_blocks_no_self check (blocker_id <> blocked_id)
);

comment on table public.user_blocks is
  'Guideline 1.2(c). Stored one-way, enforced symmetrically by visibility.blocked_pair_ids — a one-way block would let the abuser keep initiating.';

-- Both directions are read on every message send and every feed build, so both
-- need an index. The unique constraint already covers (blocker_id, blocked_id).
create index if not exists user_blocks_blocked_idx
    on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;

drop policy if exists "user_blocks_select_own" on public.user_blocks;
create policy "user_blocks_select_own" on public.user_blocks
    for select
    to authenticated
    using (blocker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. hidden_at — the "remove the offending content" capability
-- ---------------------------------------------------------------------------
-- Guideline 1.2 wants objectionable content REMOVED, not just reported. Without
-- a column to write, "we act on reports" is a promise in the review notes rather
-- than something the app can do. A nullable timestamp (not a boolean) so the
-- audit trail carries WHEN, matching disputes.resolved_at.
--
-- Soft-hide, not delete: the row has to survive for the admin trail and, on
-- messages, for the CRA-retention posture me.py already documents.
alter table public.messages
  add column if not exists hidden_at timestamptz;

alter table public.reviews
  add column if not exists hidden_at timestamptz;

alter table public.service_posts
  add column if not exists hidden_at timestamptz;

alter table public.booking_photos
  add column if not exists hidden_at timestamptz;

comment on column public.messages.hidden_at is
  'Set by moderation when a report is resolved with action_taken = content_hidden. Read paths filter on "hidden_at is null"; the row itself is retained.';
comment on column public.reviews.hidden_at is
  'Set by moderation when a report is resolved with action_taken = content_hidden. Hidden reviews are excluded from the business rating feed.';
comment on column public.service_posts.hidden_at is
  'Set by moderation when a report is resolved with action_taken = content_hidden. Hidden posts leave the discovery feed.';
comment on column public.booking_photos.hidden_at is
  'Set by moderation when a report is resolved with action_taken = content_hidden. Hidden photos stop being served in booking/proof galleries.';

-- Feed and thread reads all filter on "hidden_at is null", which on a
-- near-empty column is best served by a partial index on the exception.
create index if not exists messages_hidden_idx
    on public.messages (hidden_at) where hidden_at is not null;
create index if not exists reviews_hidden_idx
    on public.reviews (hidden_at) where hidden_at is not null;
create index if not exists service_posts_hidden_idx
    on public.service_posts (hidden_at) where hidden_at is not null;
create index if not exists booking_photos_hidden_idx
    on public.booking_photos (hidden_at) where hidden_at is not null;

commit;
