-- =============================================================================
-- 20260725220000_owner_is_the_default_assignee.sql
--
-- APPLIED — verified live against project ulnxapnsenzyddddldjt on 2026-07-31 by
-- probing PostgREST for the objects this file creates. The header below used to
-- read "FILED, PENDING APPLY"; that was written when the authoring worktree had
-- no Supabase credentials and was never updated after the migration was run.
--
-- Leaving it stale is not cosmetic: someone reading it re-derives a to-do that
-- is already done, and on 2026-07-31 that cost a round trip when a hand-written
-- APPLY-*.sql was drafted for changes that were already live. Migration files
-- assert things about production, so an assertion that has gone false is a bug
-- in the file. Re-running it is harmless (every statement is idempotent), but it
-- is not needed.
--
-- WALKTHROUGH M8 — "owner is the default assignee (never 'No active employees
-- found')".
--
-- THE BUG the founder hit: `employees` rows are only ever created by
-- POST /employees/ (backend/app/api/employees.py), which invites a NEW person
-- with their own auth account. The person who registered the business is never
-- in that table. So for a solo operator — the overwhelmingly common case at
-- launch — `GET /employees/` returns [], the assign picker rendered the literal
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
--   employees.py GET /{id}/profile (jobs_completed, tenure) — already correct
-- A sentinel employee_id, or a nullable "assigned to owner" flag, would have
-- required touching each of those read paths and would have left every one of
-- them with a null-employee branch to get wrong.
--
-- The owner's `users.role` is deliberately NOT changed — they stay
-- 'business_owner' (their whole auth/routing surface keys off it). An
-- `employees` row is a STAFFING record, not an account role.
--
-- Everything here is ADDITIVE and idempotent: no drops, no type changes, safe
-- to re-run. The backend also creates this row lazily on first use
-- (bookings.py::_ensure_owner_employee), so a business registered AFTER this
-- migration runs is covered too — the backfill below is for the ones that
-- already exist.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- PART 1 — one owner row per existing business, where missing
-- ---------------------------------------------------------------------------
-- `not exists` makes this re-runnable and means a business whose owner already
-- happens to have an employees row (e.g. they invited themselves by email) is
-- left completely alone — including their chosen role_title.
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
-- PART 2 — one employees row per (business, person)
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
