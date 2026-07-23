# SwingBy — Database Schema

**Source of truth: the live database.** This file was regenerated on **2026-07-21** by
introspecting Supabase project `ulnxapnsenzyddddldjt` (ca-central-1) with
`information_schema.columns` + `pg_constraint` + `pg_policies`. If it disagrees with prod,
prod wins — re-run the queries at the bottom and update this file.

**16 tables in `public`.** RLS is **enabled on all 16**, and every table has at least one
policy. `service_role` (the FastAPI backend) bypasses RLS; no frontend talks to Supabase
directly.

| Table | Purpose | Policies |
|---|---|---|
| `users` | Accounts — one table, four roles | 2 |
| `businesses` | Provider profile + subscription state | 4 |
| `employees` | Staff attached to a business | 3 |
| `service_posts` | Client job posts | 3 |
| `interests` | Business quotes on a post (spam shield) | 3 |
| `bookings` | The job once a quote is accepted | 1 |
| `payments` | Escrow ledger per booking | 1 |
| `booking_events` | Live status timeline | 1 |
| `booking_photos` | Before/after proof of work | 1 |
| `messages` | Chat on a quote thread or a booking | 2 |
| `reviews` | Ratings, both directions | 2 |
| `cancellations` | Cancel record + penalty | 1 |
| `disputes` | Client/business disputes, admin-resolved | 2 |
| `referrals` | Referral codes + credit | 2 |
| `push_tokens` | Expo push tokens per device | 4 |
| `audit_log` | Admin/system action trail | 2 |

---

## Columns

Types are the live Postgres types. `NN` = NOT NULL.

### `users`
| Column | Type | NN | Default / note |
|---|---|---|---|
| id | uuid | ✅ | `gen_random_uuid()` |
| first_name | text | ✅ | |
| last_name | text | ✅ | |
| email | text | ✅ | unique |
| phone | text | | |
| role | text | ✅ | |
| avatar_url | text | | |
| created_at | timestamptz | | `now()` |
| deleted_at | timestamptz | | soft delete (`DELETE /me`) |
| is_suspended | boolean | ✅ | `false` |

> **There is no `name` column.** It is `first_name` + `last_name`. Anything selecting or
> writing `name` will 500.

- CHECK: `role ∈ (client, business_owner, employee, admin)`
- FK: `id → auth.users(id) ON DELETE CASCADE`
- UNIQUE: `email`

### `businesses`
| Column | Type | NN | Default / note |
|---|---|---|---|
| id | uuid | ✅ | `gen_random_uuid()` |
| owner_id | uuid | ✅ | |
| business_name | text | ✅ | |
| category | text | ✅ | |
| custom_category | text | | |
| description | text | | |
| license_number | text | | |
| license_status | text | | `'pending'` |
| lat | float8 | | |
| lng | float8 | | |
| service_radius_km | float8 | | `25` |
| avg_rating | float8 | | `0` |
| review_count | int4 | | `0` |
| created_at | timestamptz | | `now()` |
| subscription_tier | text | | `'solo'` |
| subscription_status | text | | `'trialing'` |
| subscription_id | text | | |
| stripe_customer_id | text | | |
| subscription_price_id | text | | |
| subscription_started_at | timestamptz | | |
| subscription_current_period_end | timestamptz | | |
| subscription_cancel_at | timestamptz | | |

- CHECKs: `license_status ∈ (pending, verified, rejected)` · `subscription_tier ∈ (solo, team, enterprise)` · `subscription_status ∈ (trialing, active, past_due, canceled, incomplete)`
- FK: `owner_id → users(id) ON DELETE CASCADE`

### `employees`
| Column | Type | NN | Default / note |
|---|---|---|---|
| id | uuid | ✅ | `gen_random_uuid()` |
| business_id | uuid | ✅ | |
| user_id | uuid | ✅ | |
| role_title | text | | |
| avatar_url | text | | |
| is_active | bool | | `true` |
| created_at | timestamptz | | `now()` |

- FKs: `business_id → businesses(id) ON DELETE CASCADE` · `user_id → users(id) ON DELETE CASCADE`

### `service_posts`
| Column | Type | NN | Default / note |
|---|---|---|---|
| id | uuid | ✅ | `gen_random_uuid()` |
| client_id | uuid | ✅ | |
| title | text | ✅ | |
| description | text | | |
| category | text | ✅ | |
| budget | float8 | ✅ | |
| status | text | | `'open'` |
| lat | float8 | | |
| lng | float8 | | |
| expires_at | timestamptz | | `now() + '7 days'` |
| created_at | timestamptz | | `now()` |
| image_urls | text[] | | `'{}'` |
| address | text | | |
| ~~`preffered_date`~~ | timestamptz | | **DEPRECATED — do not read or write** |
| preferred_date | timestamptz | | the real column |
| geocoded_at | timestamptz | | |
| geocode_source | text | | |

> **`preffered_date` (two f's) is a typo column** left over from the original migration.
> It holds **0 rows of data** and has **no code references**. Always use `preferred_date`.
> The typo column survives only because dropping it needs its own migration — treat it as
> write-never.

- CHECKs: `status ∈ (open, matched, expired, cancelled)` · `geocode_source IS NULL OR geocode_source ∈ (places_autocomplete, geocoding_api, manual, failed)`
- FK: `client_id → users(id) ON DELETE CASCADE`

### `interests`
| Column | Type | NN | Default / note |
|---|---|---|---|
| id | uuid | ✅ | `gen_random_uuid()` |
| post_id | uuid | ✅ | |
| business_id | uuid | ✅ | |
| quoted_price | float8 | | |
| status | text | | `'pending'` |
| created_at | timestamptz | | `now()` |

- CHECK: `status ∈ (pending, accepted, rejected)`
- FKs: `post_id → service_posts(id) ON DELETE CASCADE` · `business_id → businesses(id) ON DELETE CASCADE`

### `bookings`
| Column | Type | NN | Default / note |
|---|---|---|---|
| id | uuid | ✅ | `gen_random_uuid()` |
| client_id | uuid | ✅ | |
| business_id | uuid | ✅ | |
| employee_id | uuid | | |
| post_id | uuid | | nullable — supports direct geo-browse bookings |
| service_category | text | ✅ | |
| total_amount | float8 | ✅ | |
| commission_rate | float8 | | `0.10` |
| platform_fee | float8 | | |
| status | text | | `'confirmed'` |
| payment_status | text | | `'held'` |
| proposed_date_1 | timestamptz | | |
| proposed_date_2 | timestamptz | | |
| proposed_date_3 | timestamptz | | |
| confirmed_date | timestamptz | | the agreed date |
| created_at | timestamptz | | `now()` |
| date_proposed_by | uuid | | who proposed the current slate |

> **There is no `completed_at` and no `scheduled_date`.** Completion time is the
> `completed` row in `booking_events`; the agreed date is `confirmed_date`.

- CHECKs: `status ∈ (confirmed, in_progress, completed, cancelled)` · `payment_status ∈ (held, partial_released, fully_released, refunded)`
- FKs: `client_id → users(id) ON DELETE CASCADE` · `business_id → businesses(id) ON DELETE CASCADE` · `employee_id → employees(id) ON DELETE SET NULL` · `post_id → service_posts(id) ON DELETE SET NULL` · `date_proposed_by → users(id)` (NO ACTION)

### `payments`
| Column | Type | NN | Default / note |
|---|---|---|---|
| id | uuid | ✅ | `gen_random_uuid()` |
| booking_id | uuid | ✅ | |
| total_charged | float8 | ✅ | |
| escrow_held | float8 | ✅ | |
| released_to_business | float8 | | `0` |
| platform_cut | float8 | ✅ | |
| stripe_payment_intent_id | text | | |
| status | text | | `'held'` |
| released_at | timestamptz | | |
| created_at | timestamptz | | `now()` |
| method | text | | |

> **There is no `notes` column on `payments`.** A doc-invented `notes` column 500'd every
> invoice in prod (fix `581653a`). Never put it in an insert/update payload.

- CHECKs: `status ∈ (pending, partial, paid_full, paid_off_platform, fully_released, refunded, failed)` · `method ∈ (stripe_card, cash, e_transfer, other)`
- FK: `booking_id → bookings(id) ON DELETE CASCADE`

> Gotcha: the column default `status = 'held'` is **not** in the CHECK list. Every explicit
> write must use one of the seven allowed values.

### `booking_events`
| Column | Type | NN | Default / note |
|---|---|---|---|
| id | uuid | ✅ | `gen_random_uuid()` |
| booking_id | uuid | ✅ | |
| actor_id | uuid | ✅ | |
| event_type | text | ✅ | |
| note | text | | |
| lat | float8 | | |
| lng | float8 | | |
| created_at | timestamptz | ✅ | `now()` |

- CHECK: `event_type ∈ (dates_proposed, date_confirmed, en_route, arrived, started, paused, resumed, completed, cancelled_event, dispute_opened, dispute_resolved, paid_offplatform)`
- FKs: `booking_id → bookings(id) ON DELETE CASCADE` · **`actor_id → users(id) ON DELETE RESTRICT`**

> **`actor_id` is `ON DELETE RESTRICT`.** A user with any booking event cannot be hard
> deleted — the delete errors out. That is why `DELETE /me` is a soft delete
> (`users.deleted_at`). Same trap on `booking_photos.uploaded_by`.

### `booking_photos`
| Column | Type | NN | Default / note |
|---|---|---|---|
| id | uuid | ✅ | `gen_random_uuid()` |
| booking_id | uuid | ✅ | |
| uploaded_by | uuid | ✅ | |
| phase | text | ✅ | |
| url | text | ✅ | |
| path | text | ✅ | storage path (used for delete) |
| caption | text | | |
| created_at | timestamptz | ✅ | `now()` |

- CHECK: `phase ∈ (before, after)`
- FKs: `booking_id → bookings(id) ON DELETE CASCADE` · **`uploaded_by → users(id) ON DELETE RESTRICT`**

### `messages`
| Column | Type | NN | Default / note |
|---|---|---|---|
| id | uuid | ✅ | `gen_random_uuid()` |
| booking_id | uuid | | |
| sender_id | uuid | ✅ | |
| content | text | ✅ | |
| sent_at | timestamptz | | `now()` |
| interest_id | uuid | | |
| read_at | timestamptz | | |

- CHECK: `booking_id IS NOT NULL OR interest_id IS NOT NULL` — a message hangs off a quote thread **or** a booking.
- FKs: `booking_id → bookings(id) ON DELETE CASCADE` · `interest_id → interests(id) ON DELETE CASCADE` · `sender_id → users(id) ON DELETE CASCADE`

### `reviews`
| Column | Type | NN | Default / note |
|---|---|---|---|
| id | uuid | ✅ | `gen_random_uuid()` |
| booking_id | uuid | ✅ | |
| reviewer_id | uuid | ✅ | |
| reviewee_id | uuid | ✅ | no FK — points at a user *or* a business |
| reviewee_type | text | ✅ | |
| rating | int4 | ✅ | |
| comment | text | | |
| created_at | timestamptz | | `now()` |

- CHECKs: `rating BETWEEN 1 AND 5` · `reviewee_type ∈ (business, client, employee)`
- FKs: `booking_id → bookings(id) ON DELETE CASCADE` · `reviewer_id → users(id) ON DELETE CASCADE`

### `cancellations`
| Column | Type | NN | Default / note |
|---|---|---|---|
| id | uuid | ✅ | `gen_random_uuid()` |
| booking_id | uuid | ✅ | |
| cancelled_by | uuid | ✅ | |
| reason | text | | |
| penalty_amount | float8 | | `0` |
| created_at | timestamptz | | `now()` |

- FKs: `booking_id → bookings(id) ON DELETE CASCADE` · `cancelled_by → users(id) ON DELETE CASCADE`

### `disputes`
| Column | Type | NN | Default / note |
|---|---|---|---|
| id | uuid | ✅ | `gen_random_uuid()` |
| booking_id | uuid | ✅ | |
| opened_by | uuid | ✅ | |
| against_party | text | ✅ | |
| issue_type | text | ✅ | |
| description | text | ✅ | |
| status | text | ✅ | `'open'` |
| resolution_notes | text | | |
| refund_amount | numeric | | |
| resolved_at | timestamptz | | |
| resolved_by | uuid | | |
| created_at | timestamptz | ✅ | `now()` |
| updated_at | timestamptz | ✅ | `now()` |

- CHECKs: `against_party ∈ (client, business)` · `issue_type ∈ (no_show, poor_quality, damage, overcharge, safety, other)` · `status ∈ (open, under_review, resolved, dismissed)`
- FKs: `booking_id → bookings(id) ON DELETE CASCADE` · `opened_by → users(id)` · `resolved_by → users(id)` (both NO ACTION)

### `referrals`
| Column | Type | NN | Default / note |
|---|---|---|---|
| id | uuid | ✅ | `gen_random_uuid()` |
| code | text | ✅ | |
| referrer_id | uuid | ✅ | |
| referee_id | uuid | | |
| status | text | ✅ | `'active'` |
| credit_cents | int4 | ✅ | `0` |
| created_at | timestamptz | ✅ | `now()` |
| updated_at | timestamptz | ✅ | `now()` |

- CHECKs: `status ∈ (active, joined, credited)` · `credit_cents >= 0` · `referee_id IS NULL OR referee_id <> referrer_id`
- FKs: `referrer_id → users(id) ON DELETE CASCADE` · `referee_id → users(id) ON DELETE CASCADE`

### `push_tokens`
| Column | Type | NN | Default / note |
|---|---|---|---|
| id | uuid | ✅ | `gen_random_uuid()` |
| user_id | uuid | ✅ | |
| token | text | ✅ | |
| platform | text | ✅ | |
| created_at | timestamptz | ✅ | `now()` |
| updated_at | timestamptz | ✅ | `now()` |

- CHECK: `platform ∈ (ios, android, web)`
- UNIQUE: `(user_id, token)` — `POST /push-tokens/register` upserts on this key
- FK: `user_id → users(id) ON DELETE CASCADE`

### `audit_log`
| Column | Type | NN | Default / note |
|---|---|---|---|
| id | uuid | ✅ | `gen_random_uuid()` |
| actor_id | uuid | | |
| action | text | ✅ | |
| resource_type | text | | |
| resource_id | uuid | | no FK — polymorphic |
| metadata | jsonb | ✅ | `'{}'` |
| ip | text | | |
| created_at | timestamptz | ✅ | `now()` |

- FK: `actor_id → users(id) ON DELETE SET NULL`

---

## Business rules that live in code, not in constraints

- **Escrow split:** 50% released on date confirmation, 50% on completion, minus a 10%
  platform cut (`bookings.commission_rate` default `0.10`) → business nets 90%.
- **Cancel penalty:** 25% if cancelled >48h before the confirmed date, 50% if ≤48h.
- **Post expiry:** `service_posts.expires_at` defaults to +7 days; a cron flips stale posts
  to `expired` (`docs/expiry_cron.sql`).
- **Geo-browse:** bounding-box pre-filter in Postgres, exact Haversine in Python. No PostGIS.

## Re-introspect prod

```sql
-- columns
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- CHECKs, FKs (incl. ON DELETE), uniques, PKs
select conrelid::regclass::text as tbl, conname, contype,
       pg_get_constraintdef(oid) as def
from pg_constraint
where connamespace = 'public'::regnamespace and contype in ('c','f','u','p')
order by tbl, contype, conname;

-- RLS + policy counts
select c.relname, c.relrowsecurity,
       (select count(*) from pg_policies p
        where p.schemaname='public' and p.tablename=c.relname) as policies
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;
```

Policy bodies live in `docs/rls_policies.sql`. How schema changes get applied and verified:
`docs/MIGRATIONS.md`.
