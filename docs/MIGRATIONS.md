# SwingBy — Database Migrations

**This document exists because the same failure has taken production down three times.**

Every failure had the same shape: **code shipped that referenced a column the database did
not have.** Not a subtle race — the column simply was never created, while a `.sql` file in
`docs/` sat there describing it, marked "FILE ONLY — do not apply to prod".

| When | Symptom | Cause |
|---|---|---|
| 2026-07-17 | service-post create 500s | code deployed ahead of schema |
| 2026-07-20 | `/payments/mine` + `/disputes/mine` 500 (PR #24) | two selected columns never existed |
| 2026-07-21 | every invoice 500s (`581653a`) | `payments.notes` written but never existed |

The 2026-07-20 fix swept `.select()` strings only. It missed two **writers** — code that put
a phantom key in an insert/update payload — which is exactly how the invoice outage happened
a day later. See the checklist below.

---

## How migrations actually work here

There is **no migration runner.** No Alembic, no `supabase/migrations/`, no CI step.

A migration is a hand-written `.sql` file in `docs/`, applied by a human pasting it into the
Supabase SQL editor.

Consequences you must internalize:

1. **`mcp__Supabase__list_migrations` is useless here.** Raw SQL run through the dashboard
   never registers in Supabase's migration tracking table. An empty migration list does
   **not** mean nothing was applied.
2. **A `.sql` file in `docs/` proves nothing.** It might be applied, half-applied, or purely
   aspirational. The file's own header comment is a claim, not evidence.
3. **The only honest answer to "is this applied?" comes from querying prod.**

## Applying a migration

1. Write the migration into `docs/<thing>.sql`. **Make every statement idempotent** —
   `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`
   before `ADD CONSTRAINT`. It must be safe to run twice, because it will be.
2. Open the SQL editor:
   <https://supabase.com/dashboard/project/ulnxapnsenzyddddldjt/sql> — or use
   `mcp__Supabase__apply_migration` if you have MCP access.
3. Run it.
4. **Verify by introspection** (next section). Do not trust the editor's "Success".
5. Update the file's header to `-- STATUS: APPLIED to prod (verified <date>).`
6. Ship the migration and the code that depends on it **in the same PR**.

### The one hard rule

> **A migration must ship in the same PR as the code that depends on it.**

Not "filed for the database agent". Not "applied later". Same PR, and applied to prod
**before or with** the deploy — never after. If the migration cannot be applied yet, the
code that reads or writes those columns cannot merge yet.

## Verifying applied state

Run this against prod. It answers "what does the database actually have", which is the only
question that matters.

```sql
-- Every table and its real columns, one row per table
select table_name, string_agg(column_name, ', ' order by ordinal_position) as columns
from information_schema.columns
where table_schema = 'public'
group by table_name
order by table_name;
```

Targeted checks:

```sql
-- does a specific column exist?
select 1 from information_schema.columns
where table_schema='public' and table_name='payments' and column_name='notes';

-- CHECK / FK / UNIQUE definitions (catches "the enum value isn't allowed yet")
select conrelid::regclass::text as tbl, conname, pg_get_constraintdef(oid)
from pg_constraint
where connamespace='public'::regnamespace and contype in ('c','f','u')
order by tbl, conname;

-- RLS on + policy count per table
select c.relname, c.relrowsecurity,
       (select count(*) from pg_policies p
        where p.schemaname='public' and p.tablename=c.relname) as policies
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r'
order by c.relname;
```

`docs/APPLY-2026-07-20.sql` STEP 0 is a worked example of a read-only verifier that reports
per-section applied/missing. Copy that pattern for any multi-part migration.

---

## Verify before you ship — checklist

Run through this for **any** PR that touches a `supabase.table(...)` call, a Pydantic model
that maps to a table, or a `.sql` file.

- [ ] **Dump live columns first.** Run the `information_schema.columns` query above and keep
      the output next to you. Do not work from `docs/swingby_database_schema.md`; that doc is
      a snapshot and can drift. Prod is the source of truth.

- [ ] **Diff `.select()` strings against live columns.** Include embedded selects
      (`users(first_name,last_name)`) — a bad embed 500s the same as a bad column.

- [ ] **Diff insert/update PAYLOAD KEYS against live columns.** ⚠️ **This is the step that
      was skipped.** The 2026-07-20 sweep only checked `.select()` strings, so two writers
      survived and `payments.notes` took down every invoice the next day. Grep the *keys of
      the dict*, not just the select strings:

      ```bash
      grep -rn "\.insert(\|\.update(\|\.upsert(" backend/app | cut -d: -f1 | sort -u
      ```

      Then, for each hit, read the payload dict and check **every key** — including keys
      added conditionally (`if x: payload["y"] = ...`) and keys spread in from
      `model_dump()`. A Pydantic model field that is not a real column is a phantom column
      the moment the request path sets it.

- [ ] **Check CHECK constraints, not just column existence.** Writing `event_type='paused'`
      into a table whose CHECK predates that value fails at insert time even though the
      column exists. Same for `status`, `phase`, `reviewee_type`, `method`, `platform`.

- [ ] **Check ON DELETE behaviour before writing any delete path.**
      `booking_events.actor_id` and `booking_photos.uploaded_by` are `ON DELETE RESTRICT` —
      a hard user delete errors. That is why `DELETE /me` is a soft delete.

- [ ] **Watch for near-miss column names.** `service_posts` has both `preffered_date`
      (typo, dead, 0 rows) and `preferred_date` (real). A misspelling that happens to exist
      silently writes to the dead column instead of erroring.

- [ ] **Confirm the migration is in this PR** and applied to prod, per the hard rule above.

- [ ] **Run the booking-loop smoke test** against a local backend pointed at a database with
      the migration applied: `python tools/e2e_smoke.py` — it does response-shape checks, so
      it catches missing columns that a 200 would hide.

- [ ] **Re-run the backend tests**: `python -m pytest backend/tests -q`.

- [ ] **Update `docs/swingby_database_schema.md`** from live introspection — same PR.

## Related

- Live schema snapshot: `docs/swingby_database_schema.md`
- RLS policy bodies: `docs/rls_policies.sql`
- Consolidated 2026-07-20 migration + its STEP 0 verifier: `docs/APPLY-2026-07-20.sql`
- Backups / restore: `docs/SUPABASE_BACKUP.md`, `docs/ROLLBACK.md`
