-- 20260724090000_proof_of_work_and_auto_bidding.sql
--
-- LANE 5 — NEW SURFACES, 2026-07-24
--
-- Two new product surfaces need storage that does not exist yet:
--
--   1. PROOF OF WORK (design/handoff-jet-pulse/PROOF-REQUEST-WEB-AUTOBID.md §1)
--      The business posts BEFORE/AFTER photos + an optional 60 s voice memo, the
--      client approves, and escrow releases. `booking_photos` already stores
--      before/after images, but it cannot distinguish a photo the CLIENT
--      supplied on the original job post (which must pre-populate BEFORE and be
--      labelled "from your job post" — walkthrough M5) from one the business
--      captured on site. It also has no notion of a proof submission being
--      "sent for approval" vs still being edited.
--
--   2. AUTO-BIDDING (§4, Kira's ruling 2026-07-24)
--      Rules-based auto-quoting, subscribers only. Needs a per-business rules
--      row, a record that the mandatory dry run was passed, and a way to tag an
--      auto-sent quote so the business sees "Auto" and the client sees nothing
--      different.
--
-- Everything here is ADDITIVE: new tables, new nullable columns with defaults,
-- no type changes, no drops. Safe to re-run — every statement is guarded by an
-- "if not exists" / "if exists" idiom.
--
-- RLS posture matches docs/rls_policies.sql and docs/booking_events_and_photos.sql:
--   anon          → zero access
--   authenticated → SELECT only when they are a party
--   service_role  → full access (all backend writes go through service_role)

begin;

-- ---------------------------------------------------------------------------
-- 1. booking_photos.source — who supplied the photo
-- ---------------------------------------------------------------------------
-- Walkthrough M5: the client's own job-post photos auto-fill the BEFORE set and
-- are labelled as client-supplied; the business adds its own before AND after on
-- top. Without this column the two are indistinguishable and the business could
-- satisfy the "2 before" minimum with the client's photos, which defeats the
-- point of proof-of-work.
alter table public.booking_photos
  add column if not exists source text not null default 'business';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'booking_photos_source_check'
  ) then
    alter table public.booking_photos
      add constraint booking_photos_source_check
      check (source in ('business', 'client'));
  end if;
end $$;

comment on column public.booking_photos.source is
  'business = captured on site by the provider (counts toward the 2+2 proof minimum). client = carried over from the client''s job post, shown in BEFORE labelled "from your job post", never counts toward the minimum.';

-- ---------------------------------------------------------------------------
-- 2. booking_voice_notes — the 60 s running-commentary memo (walkthrough M6)
-- ---------------------------------------------------------------------------
-- One memo per booking: re-recording REPLACES rather than appends, so the
-- UNIQUE(booking_id) is the product rule, not just hygiene.
create table if not exists public.booking_voice_notes (
    id               uuid primary key default gen_random_uuid(),
    booking_id       uuid not null unique
                       references public.bookings(id) on delete cascade,
    recorded_by      uuid not null references public.users(id) on delete restrict,
    url              text not null,
    path             text not null,
    duration_seconds integer not null check (duration_seconds > 0 and duration_seconds <= 60),
    created_at       timestamptz not null default now()
);

comment on table public.booking_voice_notes is
  'Proof-of-work voice memo. Hard-capped at 60 s by the CHECK; one row per booking (re-record replaces).';

alter table public.booking_voice_notes enable row level security;

drop policy if exists "booking_voice_notes_select_party" on public.booking_voice_notes;
create policy "booking_voice_notes_select_party" on public.booking_voice_notes
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.bookings b
            left join public.businesses bz on bz.id = b.business_id
            left join public.employees   e on e.id = b.employee_id
            where b.id = booking_voice_notes.booking_id
              and (
                  b.client_id  = auth.uid()
                  or bz.owner_id = auth.uid()
                  or e.user_id   = auth.uid()
              )
        )
    );

-- ---------------------------------------------------------------------------
-- 3. booking_proofs — the submission itself
-- ---------------------------------------------------------------------------
-- A booking's photos can exist while the business is still working. The proof is
-- only "sent for approval" once, and the client's approval is what releases the
-- money. Statuses:
--   draft      photos/memo being captured, client sees nothing
--   submitted  business tapped "Send for approval" (>= 2 business before +
--              >= 2 business after enforced server-side, not only in the UI)
--   approved   client approved → escrow released
--   disputed   client tapped "Something's wrong" → funds STAY HELD
create table if not exists public.booking_proofs (
    id            uuid primary key default gen_random_uuid(),
    booking_id    uuid not null unique
                    references public.bookings(id) on delete cascade,
    status        text not null default 'draft'
                    check (status in ('draft', 'submitted', 'approved', 'disputed')),
    submitted_by  uuid references public.users(id) on delete set null,
    submitted_at  timestamptz,
    approved_at   timestamptz,
    disputed_at   timestamptz,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists booking_proofs_status_idx
    on public.booking_proofs (status);

alter table public.booking_proofs enable row level security;

drop policy if exists "booking_proofs_select_party" on public.booking_proofs;
create policy "booking_proofs_select_party" on public.booking_proofs
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.bookings b
            left join public.businesses bz on bz.id = b.business_id
            left join public.employees   e on e.id = b.employee_id
            where b.id = booking_proofs.booking_id
              and (
                  b.client_id  = auth.uid()
                  or bz.owner_id = auth.uid()
                  or e.user_id   = auth.uid()
              )
        )
    );

-- ---------------------------------------------------------------------------
-- 4. business_auto_bid_rules — the auto-bidding rule set
-- ---------------------------------------------------------------------------
-- Money is stored in INTEGER CENTS, consistent with migration
-- 20260723120000_money_integer_cents_and_ledger_integrity.sql. No floats.
--
-- floor_cents is a HARD floor: the send-time bid is clamped up to it and the
-- quote is skipped rather than sent below it, even if that loses the job.
--
-- dry_run_passed_at is the gate. Auto-bidding cannot be switched on for the
-- first time without passing through the dry-run sheet; `enabled` may only be
-- true when this is non-null, enforced by the CHECK below AND re-checked in
-- backend/app/api/auto_bidding.py.
create table if not exists public.business_auto_bid_rules (
    business_id        uuid primary key
                         references public.businesses(id) on delete cascade,
    enabled            boolean not null default false,
    categories         text[] not null default '{}',
    radius_km          integer not null default 12
                         check (radius_km between 1 and 100),
    hourly_rate_cents  integer not null default 0
                         check (hourly_rate_cents >= 0),
    floor_cents        integer not null default 0
                         check (floor_cents >= 0),
    max_bids_per_day   integer not null default 8
                         check (max_bids_per_day between 1 and 50),
    require_free_crew  boolean not null default true,
    dry_run_passed_at  timestamptz,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    constraint business_auto_bid_rules_dry_run_before_enable
      check (enabled = false or dry_run_passed_at is not null)
);

comment on table public.business_auto_bid_rules is
  'Auto-bidding rules. PAID FEATURE — entitlement is businesses.subscription_status in (active, trialing), checked in the API, not here. The client budget is NEVER an input: the bid comes from hourly_rate_cents x the job scope, clamped to floor_cents.';

alter table public.business_auto_bid_rules enable row level security;

drop policy if exists "auto_bid_rules_select_owner" on public.business_auto_bid_rules;
create policy "auto_bid_rules_select_owner" on public.business_auto_bid_rules
    for select
    to authenticated
    using (
        exists (
            select 1 from public.businesses bz
            where bz.id = business_auto_bid_rules.business_id
              and bz.owner_id = auth.uid()
        )
    );

-- ---------------------------------------------------------------------------
-- 5. interests — tag auto-sent quotes + the 5-minute withdraw window
-- ---------------------------------------------------------------------------
-- An auto-sent quote is an ORDINARY quote. It shows an "Auto" tag in the
-- business's own sent list and is indistinguishable to the client, so this is a
-- column on interests rather than a separate table. auto_withdrawable_until
-- carries the 5-minute window; after it lapses, normal quote rules apply.
alter table public.interests
  add column if not exists is_auto boolean not null default false,
  add column if not exists auto_withdrawable_until timestamptz;

comment on column public.interests.is_auto is
  'True when this quote was sent by the auto-bidding engine. Surfaced to the BUSINESS as an "Auto" tag; never exposed to the client.';
comment on column public.interests.auto_withdrawable_until is
  'Auto-sent quotes can be withdrawn without penalty until this instant (send time + 5 minutes).';

-- Daily-cap counting: "how many auto-bids has this business sent today" is a
-- send-time check, so it must be cheap.
create index if not exists interests_auto_business_created_idx
    on public.interests (business_id, created_at)
    where is_auto = true;

commit;
