---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build]
---
# SwingBy — Database Schema

> **Reconstructed from repo migrations + backend code, NOT from live DB introspection.**
> No live Supabase credentials were available on this box when this doc was written
> (2026-07-18). This is a best-effort reconstruction assembled by database-agent from:
> `docs/*.sql` migration files, `docs/rls_policies.sql`, and every
> `supabase.table("...")` call + Pydantic request model in `backend/app/api/*.py`.
> It has **not** been verified against `list_tables` / `execute_sql`. Treat any single
> detail here as provisional until the next agent with live DB access runs
> `mcp__Supabase__list_tables` and reconciles this file — flag diffs, don't silently
> "fix" this doc without a REQUEST trail.
>
> Two items below are **FILED, pending apply** — the migration exists in `docs/` but
> has not been run against the database (per this task's instructions, this agent did
> not apply them): the `referrals` table (`docs/referrals_table.sql`) and the
> `service_posts.preferred_date` column (`docs/service_posts_preferred_date.sql`).
> Everything else is inferred as already applied because backend code actively reads/
> writes it and no other migration adds it — see the per-table "Source" line.

---

## Conventions

- All primary keys are `uuid`, default `gen_random_uuid()`, unless noted (e.g. `users.id` mirrors `auth.users.id`).
- `created_at` / `updated_at` are `timestamptz`, default `now()`, unless noted.
- RLS pattern used everywhere: `anon` → zero access · `authenticated` → scoped to own rows / public-safe rows · `service_role` (FastAPI backend) → bypasses RLS entirely and is the only writer for most tables. See `docs/rls_policies.sql` header.
- "Source" on each table tells you where the column list was reconstructed from — migration SQL is authoritative where it exists; everything else is inferred from Pydantic models + `.insert()/.update()/.select()` payloads in `backend/app/api/*.py`, so **types are best-effort guesses** for those columns.

---

## 1. `users`

**Source:** no CREATE TABLE found in `docs/*.sql` (table predates the migrations kept in this repo) — reconstructed from `docs/wave-5-admin-role.sql` (role CHECK), `docs/rls_policies.sql`, `backend/app/api/auth.py`, `backend/app/api/admin.py`, `backend/app/deps.py`.

| Column | Type (inferred) | Notes |
|---|---|---|
| `id` | `uuid` PK | Mirrors `auth.users.id` — a DB trigger (`handle_new_user()`, referenced in `auth.py` comments) auto-inserts a bare row on Supabase Auth signup; app code then `upsert`s the full profile over it. |
| `email` | `text` | |
| `first_name` | `text` | |
| `last_name` | `text` | |
| `phone` | `text`, nullable | E.164 format enforced at the API layer, not DB. |
| `role` | `text` | CHECK constraint (`users_role_check`, redefined in `docs/wave-5-admin-role.sql`): `'client' \| 'business_owner' \| 'employee' \| 'admin'`. `admin` is **not** settable via signup API — DB-only. |
| `avatar_url` | `text`, nullable | |
| `is_suspended` | `boolean`, default `false` | Referenced by `admin.py` as a required column ("Wave 6 migration should add it if not already present" — comment suggests uncertain apply state; treat as **unverified**). |
| `created_at` | `timestamptz` | |

**RLS:** `authenticated` users SELECT/UPDATE only their own row (`auth.uid() = id`); no direct INSERT policy — all inserts go through `service_role` (signup flow). RLS enabled (`docs/rls_policies.sql` §1).

---

## 2. `businesses`

**Source:** no CREATE TABLE found; reconstructed from `docs/rls_policies.sql` §2, `docs/wave-10-seed-businesses.sql` (INSERT columns), `backend/app/api/businesses.py`, `backend/app/api/subscriptions.py`, `backend/app/api/payments_stripe.py`.

| Column | Type (inferred) | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `owner_id` | `uuid` FK → `users.id` | One business per owner (enforced at API layer, not a DB unique constraint as far as reconstructed). |
| `business_name` | `text` | |
| `category` | `text` | Normalized via `app/categories.py::normalize_category`; matched case-insensitively (`ilike`) elsewhere — not a DB enum. |
| `custom_category` | `text`, nullable | |
| `description` | `text`, nullable | |
| `license_number` | `text`, nullable | |
| `license_status` | `text` | Values seen: `'verified'` (seed data), presumably also an unverified/pending state — exact CHECK not found in repo. |
| `lat` / `lng` | `double precision`, nullable | |
| `service_radius_km` | `numeric`, default `25.0` | |
| `avg_rating` | `numeric`, default `0` | Kept in sync by `reviews.py::create_review` (recomputed average on each new business review). |
| `review_count` | `integer`, default `0` | Same sync point as `avg_rating`. |
| `stripe_customer_id` | `text`, nullable | Set on first subscribe checkout (`subscriptions.py`). |
| `subscription_tier` | `text`, nullable | `'solo' \| 'team'` — auto-derived from active employee count. |
| `subscription_status` | `text`, default `'trialing'` | Values seen: `trialing`, `active`, `past_due`, plus whatever Stripe subscription status strings flow through `_sync_subscription()` in `payments_stripe.py` (no DB CHECK found — likely free text mirroring Stripe). |
| `subscription_id` | `text`, nullable | Stripe subscription ID. |
| `subscription_current_period_end` | `timestamptz`, nullable | |
| `subscription_cancel_at` | `timestamptz`, nullable | |
| `subscription_started_at` | `timestamptz`, nullable | |

**RLS:** any `authenticated` user may SELECT (public discovery); only the owner may INSERT/UPDATE/DELETE their own row (`auth.uid() = owner_id`). RLS enabled (`docs/rls_policies.sql` §2).

---

## 3. `employees`

**Source:** no CREATE TABLE found; reconstructed from `docs/rls_policies.sql` §3, `backend/app/api/employees.py`, `backend/app/api/subscriptions.py`.

| Column | Type (inferred) | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `business_id` | `uuid` FK → `businesses.id` | |
| `user_id` | `uuid` FK → `users.id` | The employee's own `auth.users`/`users` row — created via `supabase.auth.admin.create_user()` at hire time, role forced to `'employee'`. |
| `role_title` | `text`, nullable | |
| `avatar_url` | `text`, nullable | |
| `is_active` | `boolean`, default `true` | Soft-deactivate flag (`deactivate`/`reactivate` endpoints toggle this; no hard delete). |
| `created_at` | `timestamptz` | Ordered on in `list_employees`. |

**RLS:** SELECT if `user_id = auth.uid()` (self) OR the caller owns the parent business; INSERT/UPDATE restricted to the owning business owner. RLS enabled (`docs/rls_policies.sql` §3).

---

## 4. `service_posts`

**Source:** no CREATE TABLE found; reconstructed from `docs/rls_policies.sql` §4, `docs/expiry_cron.sql`, `docs/service_posts_preferred_date.sql` (**FILED, pending apply**), `backend/app/api/service_posts.py`.

| Column | Type (inferred) | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `client_id` | `uuid` FK → `users.id` | |
| `title` | `text` | 3–120 chars (API-level). |
| `description` | `text`, nullable | |
| `category` | `text` | Resolved via `app/categories.py::resolve_create_category`. |
| `budget` | `numeric` | > 0. |
| `lat` / `lng` | `double precision`, nullable | |
| `address` | `text`, nullable | |
| `image_urls` | `text[]` (jsonb array or text[]) | Max 5 URLs, API-enforced. |
| `preferred_date` | `timestamptz`, nullable | **FILED, pending apply** — `docs/service_posts_preferred_date.sql`, additive nullable column, no backfill needed. Backend code (`ServicePostCreate`/`ServicePostUpdate`) already reads/writes this field, so until the migration is applied those calls will fail against a live DB missing the column. |
| `status` | `text` | Values: `'open' \| 'matched' \| 'expired' \| 'cancelled'` (from `Literal` type in API + `expire_old_service_posts()` cron). No DB CHECK confirmed, but the `pg_cron` job (`docs/expiry_cron.sql`) flips `open` → `expired` hourly once `expires_at < now()`. |
| `expires_at` | `timestamptz` | Referenced only by the expiry cron function — not written anywhere in `backend/app/api/*.py` that was found; likely has a DB default (e.g. `created_at + interval`) not visible from this repo. **Could not fully reconstruct — flag for live-DB check.** |
| `created_at` | `timestamptz` | |

**RLS:** `authenticated` SELECT when `status = 'open'` OR `client_id = auth.uid()`; INSERT/UPDATE restricted to the owning client. RLS enabled (`docs/rls_policies.sql` §4).

---

## 5. `interests`

**Source:** no CREATE TABLE found; reconstructed from `docs/rls_policies.sql` §5, `backend/app/api/interests.py`.

| Column | Type (inferred) | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `post_id` | `uuid` FK → `service_posts.id` | |
| `business_id` | `uuid` FK → `businesses.id` | |
| `quoted_price` | `numeric`, nullable | > 0 when present; falls back to the post's `budget` when accepted. |
| `status` | `text` | `'pending' \| 'accepted' \| 'rejected'`. |
| `created_at` | `timestamptz` | |

**RLS:** SELECT for the quoting business owner or the post's client; INSERT restricted to business owners; UPDATE (accept/reject) restricted to the post's client. RLS enabled (`docs/rls_policies.sql` §5).

---

## 6. `bookings`

**Source:** no CREATE TABLE found; reconstructed from `docs/rls_policies.sql` §6, `docs/bookings_payment_status_allow_refunded.sql`, `backend/app/api/interests.py` (creation), `backend/app/api/bookings.py`, `backend/app/api/payments.py`, `backend/app/api/invoices.py`, `backend/app/api/disputes.py`.

| Column | Type (inferred) | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `client_id` | `uuid` FK → `users.id` | |
| `business_id` | `uuid` FK → `businesses.id` | |
| `employee_id` | `uuid` FK → `employees.id`, nullable | Set via `PATCH /bookings/{id}/assign-employee`. |
| `post_id` | `uuid` FK → `service_posts.id`, nullable | Null for future direct/geo-browse bookings not originating from a post. |
| `service_category` | `text` | Copied from the post's category at booking-creation time. |
| `total_amount` | `numeric` | = `interests.quoted_price` or `service_posts.budget`. |
| `commission_rate` | `numeric`, default `0.10` | |
| `platform_fee` | `numeric` | = `total_amount * commission_rate`, computed at creation. |
| `status` | `text` | Values seen: `'confirmed' \| 'in_progress' \| 'completed' \| 'cancelled'`. No DB CHECK text found, inferred from every status transition in `bookings.py`. |
| `payment_status` | `text` | CHECK `bookings_payment_status_check`, extended by `docs/bookings_payment_status_allow_refunded.sql`: `'held' \| 'partial_released' \| 'fully_released' \| 'refunded'`. |
| `proposed_date_1` / `_2` / `_3` | `text` (ISO-8601 string, not a `date`/`timestamptz` column) | App explicitly treats these as plain strings ("mirrors bookings.py's date-string idiom"), not parsed dates. |
| `date_proposed_by` | `uuid` FK → `users.id`, nullable | Tracks which side proposed — enforces "proposer can't accept their own dates" handshake rule. |
| `confirmed_date` | `text` (ISO-8601 string) | Set by `PATCH /confirm-date` (propose/accept handshake), OR at booking creation by `PATCH /interests/{id}/accept` when the originating post's `service_posts.preferred_date` was set (CARD-20, D2 — skips the handshake since the time was already given at posting). |
| `scheduled_date` | *(column referenced in `select()` calls; never written anywhere found)* | Read in `payments.py`, `disputes.py`, `invoices.py` selects but no `.insert()`/`.update()` payload sets it in the reconstructed code. **Could not fully reconstruct — likely legacy/unused or set by a DB default/trigger not in this repo; verify against live DB.** |
| `completed_at` | `timestamptz`, nullable | Read in `invoices.py`/`payments.py` selects; not explicitly set in any `.update()` found (booking `status` flips to `completed` in `bookings.py::complete_booking` without visibly stamping `completed_at` — possible DB trigger, or a gap). **Partial reconstruction.** |
| `created_at` | `timestamptz` | |

**RLS:** SELECT only for the client, the business owner, or the assigned employee. No direct INSERT/UPDATE policies — all writes via `service_role`. RLS enabled (`docs/rls_policies.sql` §6).

---

## 7. `booking_events`

**Source:** `docs/booking_events_and_photos.sql` (applied — CREATE TABLE with full DDL). Cross-checked against `backend/app/api/booking_events.py`, `backend/app/api/disputes.py`, `backend/app/api/payments_offplatform.py`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK, default `gen_random_uuid()` | |
| `booking_id` | `uuid NOT NULL` FK → `bookings.id` ON DELETE CASCADE | |
| `actor_id` | `uuid NOT NULL` FK → `users.id` ON DELETE RESTRICT | |
| `event_type` | `text NOT NULL` CHECK | Migration CHECK list: `'dates_proposed', 'date_confirmed', 'en_route', 'arrived', 'started', 'paused', 'resumed', 'completed', 'cancelled_event'`. `docs/booking_events_event_type_extend.sql` (CARD-02, **not yet applied live**) adds `'dispute_opened', 'dispute_resolved', 'paid_offplatform'`. |
| `note` | `text`, nullable | |
| `lat` / `lng` | `double precision`, nullable | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

Index: `booking_events_booking_id_created_at_idx (booking_id, created_at)`.

> **Discrepancy found (flagged, not fixed — docs-only task, no schema changes made):**
> `backend/app/api/disputes.py` inserts `event_type = 'dispute_opened'` / `'dispute_resolved'`, and
> `backend/app/api/payments_offplatform.py` inserts `event_type = 'paid_offplatform'`. Neither value is in
> the CHECK constraint list above from `docs/booking_events_and_photos.sql`. Either (a) a later migration
> widened the CHECK and that migration file isn't in this repo, or (b) those inserts are silently failing/
> erroring against the live CHECK constraint today. Both call sites wrap the insert in `try/except` and only
> log a warning on failure, so a live failure would not surface loudly. **Recommend the next agent with
> Supabase access runs `get_advisors`/`execute_sql` to check the live CHECK definition and reconcile.**
>
> **CARD-02 (2026-07-19):** fix written as `docs/booking_events_event_type_extend.sql`, verified against a
> local Postgres 16 in `backend/tests/test_booking_events_check.py` (pre-migration inserts violate the
> CHECK; post-migration all three insert and surface in the timeline query). **Not yet applied to the live
> project** — still needs `apply_migration` after approval, and the live-CHECK reconciliation above still
> applies before running it.

**RLS:** `authenticated` SELECT only if a party to the parent booking (client / business owner / assigned employee, via subquery join). No INSERT/UPDATE/DELETE policy for `authenticated` — writes are `service_role`-only. RLS enabled.

---

## 8. `booking_photos`

**Source:** `docs/booking_events_and_photos.sql` (applied — CREATE TABLE with full DDL). Cross-checked against `backend/app/api/booking_photos.py`, `backend/app/api/uploads.py`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK, default `gen_random_uuid()` | |
| `booking_id` | `uuid NOT NULL` FK → `bookings.id` ON DELETE CASCADE | |
| `uploaded_by` | `uuid NOT NULL` FK → `users.id` ON DELETE RESTRICT | |
| `phase` | `text NOT NULL` CHECK `IN ('before', 'after')` | |
| `url` | `text NOT NULL` | Public Supabase Storage URL, from `POST /uploads/image` (bucket `job-photos`). |
| `path` | `text NOT NULL` | Storage object path, e.g. `posts/{user_id}/{uuid}.{ext}`. |
| `caption` | `text`, nullable | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |

Index: `booking_photos_booking_id_phase_idx (booking_id, phase, created_at)`.

**RLS:** `authenticated` SELECT only if a party to the parent booking. INSERT/UPDATE/DELETE: `service_role` only. RLS enabled.

---

## 9. `messages`

**Source:** no CREATE TABLE found; reconstructed from `docs/rls_policies.sql` §7, `backend/app/api/messages.py`, `backend/app/api/interests.py` (re-parenting on accept), `backend/app/api/me.py` (anonymisation on delete).

| Column | Type (inferred) | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `booking_id` | `uuid` FK → `bookings.id`, nullable | Exactly one of `booking_id` / `interest_id` set per row (app-enforced via `model_validator`, not a DB CHECK found). Re-parented from `interest_id`→`booking_id` on quote acceptance (`interests.py::accept_interest`). |
| `interest_id` | `uuid` FK → `interests.id`, nullable | Pre-booking negotiation thread. |
| `sender_id` | `uuid` FK → `users.id` | Anonymised to a ghost UUID (`00000000-0000-0000-0000-000000000000`) + `content` overwritten to `'[deleted]'` on account deletion (`me.py`), rather than row-deleted, to preserve thread integrity for the other party. |
| `content` | `text` | 1–2000 chars. |
| `sent_at` | `timestamptz` | Ordering column (equivalent role to `created_at` elsewhere). |
| `read_at` | `timestamptz`, nullable | Set on read by `_mark_read()`. |

**RLS:** SELECT/INSERT scoped to booking participants (client / business owner / assigned employee), matched via subquery on `bookings`. RLS enabled (`docs/rls_policies.sql` §7).

---

## 10. `reviews`

**Source:** no CREATE TABLE found; reconstructed from `docs/rls_policies.sql` §9, `backend/app/api/reviews.py`, `backend/app/api/employees.py` (employee trust-card reads).

| Column | Type (inferred) | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `booking_id` | `uuid` FK → `bookings.id` | One review per (`booking_id`, `reviewer_id`) — app-enforced dup check, not confirmed as a DB unique constraint. |
| `reviewer_id` | `uuid` FK → `users.id` | |
| `reviewee_id` | `uuid` | **Polymorphic** — either a `businesses.id` (when `reviewee_type='business'`) or a `users.id` (when `reviewee_type='client'` or `'employee'`). Not a clean FK to one table. |
| `reviewee_type` | `text` | CHECK values confirmed in use: `'business' \| 'client'`. `employees.py` docstring notes `'employee'` is **not yet** in the CHECK ("reviews.reviewee_type CHECK currently allows only ('client','business')") — so employee-targeted reviews are planned but not live. |
| `rating` | `integer` | 1–5 (API-enforced). |
| `comment` | `text`, nullable | |
| `created_at` | `timestamptz` | |

**RLS:** business reviews (`reviewee_type='business'`) are publicly SELECT-able to `authenticated`; others visible only to the reviewer or reviewee. INSERT restricted to `reviewer_id = auth.uid()`. RLS enabled (`docs/rls_policies.sql` §9).

**Side effect:** on a new business review, `reviews.py` recomputes and writes `businesses.avg_rating` + `businesses.review_count`.

---

## 11. `cancellations`

**Source:** no CREATE TABLE found; reconstructed from `docs/rls_policies.sql` §10, `backend/app/api/bookings.py::cancel_booking`.

| Column | Type (inferred) | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `booking_id` | `uuid` FK → `bookings.id` | |
| `cancelled_by` | `uuid` FK → `users.id` | |
| `reason` | `text`, nullable | |
| `penalty_amount` | `numeric` | 0 / 25% / 50% of `total_amount` depending on proximity to `confirmed_date` (>48h / ≤48h). |
| `created_at` | `timestamptz` | Implied; not directly observed in an insert payload but is the table's evident time column given RLS naming and repo conventions. |

**RLS:** SELECT only for the booking's client or business owner. Writes via `service_role` only. RLS enabled (`docs/rls_policies.sql` §10).

---

## 12. `payments`

**Source:** no CREATE TABLE found; reconstructed from `docs/rls_policies.sql` §8, `backend/app/api/interests.py` (creation), `backend/app/api/bookings.py` (release logic), `backend/app/api/payments.py`, `backend/app/api/payments_stripe.py`, `backend/app/api/payments_offplatform.py`.

| Column | Type (inferred) | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `booking_id` | `uuid` FK → `bookings.id` | |
| `total_charged` | `numeric` | |
| `escrow_held` | `numeric` | 50% of total at booking creation; 0 after full release. |
| `released_to_business` | `numeric` | 50% at creation → full remaining (minus platform cut) at job completion. |
| `platform_cut` | `numeric` | = `bookings.platform_fee` at creation. |
| `status` | `text` | CHECK, referenced in code comments as `payments_status_check`. Values enumerated in `bookings.py` comment: `pending \| partial \| paid_full \| paid_off_platform \| fully_released \| refunded \| failed`. **This CHECK constraint governs writes — code writing an invalid value has caused incidents before (per database-agent role doc); treat this list as load-bearing.** |
| `method` | `text`, nullable | `'cash' \| 'e_transfer' \| 'other'` for off-platform payments; implicitly `'stripe_card'` for on-platform (see `invoices.py` default). |
| `notes` | `text`, nullable | Free text — stores e.g. `stripe_session={id}` for traceability, or the off-platform note. |
| `released_at` | `timestamptz`, nullable | Stamped on full release (`bookings.py::complete_booking`). |
| `created_at` | `timestamptz` | |

**RLS:** SELECT only for the client or business owner of the parent booking. Writes via `service_role` only. RLS enabled (`docs/rls_policies.sql` §8).

**Note:** no separate `subscriptions` table — subscription state lives on `businesses.subscription_*` columns (see §2). `payments_stripe.py` and `payments_offplatform.py` both read/write this same `payments` table and `bookings`; they don't own separate tables.

---

## 13. `disputes`

**Source:** `docs/disputes_table.sql` (applied — CREATE TABLE with full DDL, applied 2026-07-01 per file header). Cross-checked against `backend/app/api/disputes.py`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK, default `gen_random_uuid()` | |
| `booking_id` | `uuid NOT NULL` FK → `bookings.id` ON DELETE CASCADE | |
| `opened_by` | `uuid NOT NULL` FK → `users.id` | |
| `against_party` | `text NOT NULL` CHECK `IN ('client', 'business')` | |
| `issue_type` | `text NOT NULL` CHECK `IN ('no_show', 'poor_quality', 'damage', 'overcharge', 'safety', 'other')` | |
| `description` | `text NOT NULL` | 10–2000 chars (API-level). |
| `status` | `text NOT NULL DEFAULT 'open'` CHECK `IN ('open', 'under_review', 'resolved', 'dismissed')` | |
| `resolution_notes` | `text`, nullable | |
| `refund_amount` | `NUMERIC(10,2)`, nullable | |
| `resolved_at` | `timestamptz`, nullable | |
| `resolved_by` | `uuid` FK → `users.id`, nullable | |
| `created_at` | `timestamptz NOT NULL DEFAULT now()` | |
| `updated_at` | `timestamptz NOT NULL DEFAULT now()` | Auto-updated via `update_disputes_updated_at()` trigger. |

Indexes: `disputes_booking_idx`, `disputes_opened_by_idx`, `disputes_status_idx`.

**RLS:** parties to the booking (opener, client, or business owner) can SELECT their own; `role='admin'` users get full `FOR ALL` access. Backend writes via `service_role`. RLS enabled.

> Note: `PATCH /disputes/{id}/resolve` is the only endpoint that sets `status='resolved'` — `'under_review'` and `'dismissed'` are defined in the CHECK but no code path in this repo transitions to them. Likely future/admin-tool-only states.

---

## 14. `push_tokens`

**Source:** no CREATE TABLE found (referenced in `docs/SUPABASE_BACKUP.md` as "the `20260527_push_tokens` migration" but that migration file is not present in this repo — **applied directly via Supabase dashboard/MCP, not committed as a `.sql` file**). Reconstructed from `backend/app/api/push_tokens.py`, `backend/app/api/me.py` (delete-on-account-erasure).

| Column | Type (inferred) | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `users.id` | |
| `token` | `text` | Device push token (APNs/FCM/web). |
| `platform` | `text` | `'ios' \| 'android' \| 'web'` (Pydantic `Literal`, not confirmed as a DB CHECK). |
| Unique constraint | on `(user_id, token)` | Inferred from `.upsert(..., on_conflict="user_id,token")` in `push_tokens.py`. |

**RLS:** not covered in `docs/rls_policies.sql` (that file predates this table) — **RLS status on this table is unverified; flag for the next Supabase-connected agent to confirm with `get_advisors`.**

---

## 15. `referrals` — FILED, pending apply

**Source:** `docs/referrals_table.sql`, written 2026-07-18 for GAP-AUDIT-2026-07-18 #4. **Not yet applied to the database** per the file's own header ("FILE ONLY — do not apply to prod; database-agent reviews and applies") and per this task's instructions. Backend code (`backend/app/api/auth.py::signup`, `backend/app/api/me.py::get_my_referrals`) already reads/writes this table — those code paths will fail against a live DB until this migration is applied.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK, default `gen_random_uuid()` | |
| `code` | `text NOT NULL` | Shareable 8-char uppercase alphanumeric code, generated app-side (`me.py::_generate_referral_code`). |
| `referrer_id` | `uuid NOT NULL` FK → `users.id` ON DELETE CASCADE | |
| `referee_id` | `uuid` FK → `users.id` ON DELETE CASCADE, nullable | `NULL` = "registry" row (one per referrer, holds their own code). Non-null = "claim" row (one per successful referral). |
| `status` | `text NOT NULL DEFAULT 'active'` CHECK `IN ('active', 'joined', 'credited')` | |
| `credit_cents` | `integer NOT NULL DEFAULT 0` CHECK `>= 0` | **Always 0 today by design** — credit *application* is explicitly out of scope for beta (Kira's call, per file header); this column exists only so a future pass has somewhere to write without a second migration. |
| `created_at` / `updated_at` | `timestamptz NOT NULL DEFAULT now()` | `updated_at` auto-maintained via `update_referrals_updated_at()` trigger. |
| CHECK `referrals_no_self_referral` | `referee_id IS NULL OR referee_id <> referrer_id` | |

Unique indexes: `referrals_one_registry_per_referrer_uidx` (one registry row per referrer, partial on `referee_id IS NULL`), `referrals_code_registry_uidx` (one referrer per code, registry rows only). Non-unique indexes on `referrer_id`, `referee_id`, `code`.

**RLS (as filed, not yet live):** a user SELECTs rows where they are `referrer_id` or `referee_id`; `role='admin'` gets `FOR ALL`. INSERT/UPDATE for non-admins intentionally not exposed — all writes go through `service_role`.

---

## 16. Non-tables (things that look like tables but aren't)

- **`waitlist`** — **not a Postgres table.** `backend/app/api/waitlist.py` writes directly to a **Notion database** (`WAITLIST_DB_ID`) via the `notion_client` SDK; there is no `supabase.table("waitlist")` call anywhere in the backend. If a future migration adds a real `waitlist` Postgres table, this doc will need a new section — as of this reconstruction it does not exist.
- **`favorites`** — no evidence found anywhere in the repo (no migration, no `.table("favorites")` call, no route). Feature does not appear to exist yet in the backend.
- **`subscriptions`** — no separate table; subscription state lives on `businesses.subscription_*` columns (see §2).

---

## Cross-cutting notes for the next database-agent session

1. **This document is unverified against the live DB.** First action on any real schema task: run `list_tables` + `list_migrations` and diff against this file before trusting any column/type here.
2. Several tables (`users`, `businesses`, `employees`, `service_posts`, `interests`, `bookings`, `messages`, `reviews`, `cancellations`, `payments`) have **no CREATE TABLE migration file in this repo** — they predate the migrations that were kept, or were created directly via the Supabase dashboard. Their column lists above are reconstructed purely from `docs/rls_policies.sql` policy conditions and backend `.select()/.insert()/.update()` payloads, so **field types are guesses** (Postgres types were never explicit anywhere in the source material).
3. `booking_events.event_type` CHECK vs. actual inserted values mismatch — see the callout under §7. Worth a live-DB check before the next migration touches that table.
4. `push_tokens` has no RLS policy documented anywhere in this repo's `.sql` files — confirm it actually has RLS enabled (the database-agent rule "RLS on every table" implies it should, but this doc can't confirm it was ever applied).
5. `bookings.scheduled_date` and `bookings.completed_at` are read in several `.select()` calls but no `.insert()/.update()` payload in the reconstructed code visibly sets them — either a DB trigger/default exists that isn't in this repo, or those columns are currently always NULL in practice. Flag for live-DB check.

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]

**Related:** [[2026-07-01]] · [[2026-07-18]] · [[2026-07-19]] · [[GAP-AUDIT-2026-07-18]]
<!-- graph-wire:end -->
