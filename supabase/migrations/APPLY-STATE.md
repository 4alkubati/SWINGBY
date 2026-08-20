# Migration apply state

**Why this file exists.** The 2026-08-15 sweep could not tell whether three
security findings were live, because nothing in this repo records what has been
run against project `ulnxapnsenzyddddldjt`. The first migration in this
directory literally opens with `APPLY STATE UNKNOWN — checked 2026-07-31 and
deliberately NOT resolved`, and it is the one carrying the S1 PII lockdown. That
is the gap this file closes.

**The rule.** A migration is not done when it is written. Add its row here with
`PENDING` when you file it, and flip it to `APPLIED <date>` the moment it runs.
A PR that adds `supabase/migrations/*.sql` without a row here is incomplete.

**This is a stopgap, not the destination.** The real fix is `supabase link` +
`supabase db push`, which keeps `supabase_migrations.schema_migrations` server
side and makes this file redundant. Until the CLI is linked, this is the record.

---

## Settling the unknowns

Three of the rows below are `UNKNOWN`. Run these in the SQL editor and update
them — each is read-only and takes seconds.

```sql
-- 1. Did 20260720000000 (the S1 column lockdown) ever run?
--    NOTE: see the caveat under it — the answer barely matters.
select grantee, table_name, column_name, privilege_type
  from information_schema.column_privileges
 where grantee = 'authenticated' and table_name in ('service_posts','businesses');

-- 2. Are the three UNIQUE constraints on?
select conname from pg_constraint
 where conname in ('businesses_owner_id_key',
                   'interests_post_id_business_id_key',
                   'bookings_post_id_key');

-- 3. Which event_type values does the CHECK allow?
select pg_get_constraintdef(oid) from pg_constraint
 where conname = 'booking_events_event_type_check';

-- 4. Does reviews.reviewee_type allow 'employee' yet?
select pg_get_constraintdef(oid) from pg_constraint
 where conname = 'reviews_reviewee_type_check';

-- 5. Post-20260815000000 check — expect ZERO rows from both.
select grantee, table_name, privilege_type
  from information_schema.role_table_grants
 where grantee in ('anon','authenticated') and table_schema = 'public';
select defaclrole::regrole, defaclobjtype, defaclacl from pg_default_acl
 where defaclnamespace = 'public'::regnamespace
   and array_to_string(defaclacl, ',') ~ '(anon|authenticated)';
```

---

## `supabase/migrations/`

| Migration | State | Notes |
|---|---|---|
| `20260720000000_s1_column_lockdown_and_unique_constraints.sql` | **UNKNOWN** | Its own header says so. **Superseded either way** — its column-level `REVOKE`s are no-ops against Supabase's table-level grant (proven in `20260815000000`), so applied or not, it never closed the leak. `20260815000000` does. Its PART 2 UNIQUE constraints are still wanted; settle with query 2. |
| `20260723120000_money_integer_cents_and_ledger_integrity.sql` | UNKNOWN | Not read by the 2026-08-15 sweep. |
| `20260723120500_repair_finding_d_double_counted_escrow.sql` | UNKNOWN | Not read by the sweep. |
| `20260724090000_proof_of_work_and_auto_bidding.sql` | UNKNOWN | RLS posture verified correct by reading; apply state not checked. |
| `20260725190000_voice_notes_bucket.sql` | UNKNOWN | Not read by the sweep. |
| `20260725210000_google_business_reviews_import.sql` | UNKNOWN | RLS deliberate and documented (tokens: service_role only). |
| `20260725220000_owner_is_the_default_assignee.sql` | APPLIED 2026-07-31 | Verified live per `20260720000000` header. |
| `20260725230000_thread_attachments_and_terms.sql` | UNKNOWN | Not read by the sweep. |
| `20260726120000_business_logo_url.sql` | UNKNOWN | Not read by the sweep. |
| `20260726130000_live_provider_location.sql` | APPLIED 2026-07-31 | Verified live per `20260720000000` header. |
| `20260727000000_charge_at_post.sql` | UNKNOWN | Trigger gated OFF in `api/service_posts.py` regardless. |
| `20260730020000_cancellation_refund_requests.sql` | UNKNOWN | Not read by the sweep. |
| `20260731090000_ugc_reports_and_blocks.sql` | UNKNOWN | Guideline 1.2 surfaces depend on it. |
| `20260731120000_approval_gated_escrow_release.sql` | UNKNOWN | Not read by the sweep. |
| `20260731140000_terms_consent.sql` | UNKNOWN | Not read by the sweep. |
| `20260803120000_stripe_connect_payouts.sql` | UNKNOWN | Not read by the sweep. |
| `20260806040000_payouts_rls.sql` | UNKNOWN | Policies read and correct. |
| `20260814000000_session_revocation.sql` | UNKNOWN | D7.4. RLS-with-no-policy is deliberate and documented at `:71-73`. |
| `20260815000000_revoke_direct_postgrest_access.sql` | **PENDING** | Sweep F1. Closes privilege escalation via `users.role` + the S1 leak. Tested on postgres:16 before filing. **Apply first.** |
| `20260815000100_reviews_insert_requires_booking.sql` | **PENDING** | Sweep F2. Defence in depth behind the grant lockdown. |
| `20260815000200_booking_events_event_type_complete.sql` | **PENDING** | Sweep F3. Supersedes `docs/booking_events_event_type_extend.sql`, which covers only 3 of the 6 missing values. |

## Loose scripts in `docs/*.sql`

Predate this directory. Left in place; do not add more — new work goes in
`supabase/migrations/`.

| Script | State |
|---|---|
| `wave-5-admin-role.sql` | APPLIED 2026-06-08 (header) |
| `bookings_payment_status_allow_refunded.sql` | APPLIED 2026-06-25 (header) |
| `stripe_events_idempotency.sql` | APPLIED 2026-07-21 (header) |
| `user_credits_table.sql` | APPLIED 2026-07-21 (header) |
| `booking_events_event_type_extend.sql` | **DO NOT APPLY** — incomplete (3 of 6 values). Superseded by `20260815000200`. |
| `reviews_reviewee_type_extend_employee.sql` | **NOT APPLIED** (header). Handled: `api/reviews.py:141-161` degrades gracefully, employee trust card returns `[]`. Apply when employee reviews are wanted. |
| `rls_policies.sql` | UNKNOWN — the 10 core tables' policies. Settle with query 5; note its two column-`REVOKE` blocks are no-ops for the same reason as `20260720000000`. |
| `APPLY-2026-07-20.sql`, `booking_events_and_photos.sql`, `business_work_index.sql`, `businesses_address_and_geocode.sql`, `card06_security_advisors_fix.sql`, `disputes_table.sql`, `expiry_cron.sql`, `geocoding_columns.sql`, `referrals_table.sql`, `service_posts_preferred_date.sql`, `service_posts_target_business_id.sql`, `users_is_ghosted.sql` | UNKNOWN — not read by the 2026-08-15 sweep |
| `backfill_stacked_businesses.sql` + `_REVERT.sql`, `wave-10-seed-businesses.sql` | data scripts, not schema |
