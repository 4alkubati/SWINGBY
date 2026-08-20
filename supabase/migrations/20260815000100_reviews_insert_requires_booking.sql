-- 20260815000100_reviews_insert_requires_booking.sql
--
-- SWEEP 2026-08-15, finding F2 — the reviews insert policy authenticates the
-- author and nothing else.
--
-- THE BUG
-- -------
-- docs/rls_policies.sql:306-308:
--
--     create policy "reviews_insert" on reviews
--         for insert
--         with check (reviewer_id = auth.uid());
--
-- That proves the author is not impersonating somebody else. It does not check
-- that a booking exists, that it completed, or that `reviewee_id` ever
-- transacted with the reviewer. Its sibling fifty lines above shows the half
-- that went missing — `messages_insert` (docs/rls_policies.sql:253-263) is
-- `sender_id = auth.uid()` AND `booking_id in (select id from bookings where …)`.
-- Reviews got the identity half and not the relationship half.
--
-- It lands on a public number, not just a row: reviews.py:122-135 recomputes
-- businesses.avg_rating and review_count by aggregating this table, and
-- reviews_select (docs/rls_policies.sql:296-303) publishes every
-- reviewee_type='business' row to all authenticated users. So a forged row is
-- visible immediately and is folded into a competitor's rating the next time
-- any legitimate review triggers the recompute.
--
-- NOTE ON DEFENCE IN DEPTH
-- ------------------------
-- 20260815000000 revokes INSERT on public.reviews from `authenticated`
-- altogether, so this policy cannot currently be reached. That is exactly why
-- it is worth fixing rather than deleting: the grant lockdown and the row
-- policy are two independent layers, and this one was wrong. If a later
-- migration re-grants table access — which is how the original hole opened —
-- the policy underneath must already be correct.
--
-- The API path is unaffected. Every backend write goes through the service_role
-- client, which bypasses RLS entirely; app/api/reviews.py keeps its own
-- booking-participant checks and is the only supported way to post a review.

begin;

drop policy if exists "reviews_insert" on reviews;

create policy "reviews_insert" on reviews
    for insert
    to authenticated
    with check (
        reviewer_id = auth.uid()
        and booking_id in (
            select id from bookings
            where client_id = auth.uid()
               or business_id in (
                   select id from businesses where owner_id = auth.uid()
               )
               or employee_id in (
                   select id from employees where user_id = auth.uid()
               )
        )
    );

commit;
