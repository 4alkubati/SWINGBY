-- =============================================================================
-- SwingBy — Row Level Security Policies
-- Run this entire script in the Supabase SQL Editor (one shot).
--
-- Architecture note:
--   The FastAPI backend uses the SERVICE_ROLE key → bypasses RLS entirely.
--   These policies protect against anyone accessing Supabase directly via the
--   anon key or a valid user JWT (i.e., bypassing our API).
--
--   Rule of thumb applied:
--     anon      → zero access to everything
--     authenticated → read-only access to public data only
--     service_role  → full access (our backend)
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. USERS
-- ─────────────────────────────────────────────────────────────────────────────
alter table users enable row level security;

-- Drop existing policies before recreating (idempotent)
drop policy if exists "users_select_own"       on users;
drop policy if exists "users_update_own"       on users;

-- Users can only read their own row
create policy "users_select_own" on users
    for select
    using (auth.uid() = id);

-- Users can only update their own row
create policy "users_update_own" on users
    for update
    using (auth.uid() = id);

-- All inserts go through the service_role key (backend) — no direct inserts


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. BUSINESSES
-- ─────────────────────────────────────────────────────────────────────────────
alter table businesses enable row level security;

drop policy if exists "businesses_select_authenticated" on businesses;
drop policy if exists "businesses_insert_own"           on businesses;
drop policy if exists "businesses_update_own"           on businesses;
drop policy if exists "businesses_delete_own"           on businesses;

-- Any authenticated user can browse businesses (needed for discovery)
create policy "businesses_select_authenticated" on businesses
    for select
    to authenticated
    using (true);

-- Owner can only insert their own business
create policy "businesses_insert_own" on businesses
    for insert
    with check (auth.uid() = owner_id);

-- Owner can only update their own business
create policy "businesses_update_own" on businesses
    for update
    using (auth.uid() = owner_id);

-- Owner can delete their own business
create policy "businesses_delete_own" on businesses
    for delete
    using (auth.uid() = owner_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. EMPLOYEES
-- ─────────────────────────────────────────────────────────────────────────────
alter table employees enable row level security;

drop policy if exists "employees_select" on employees;
drop policy if exists "employees_insert" on employees;
drop policy if exists "employees_update" on employees;

-- Business owner sees their own employees; employee sees their own record
create policy "employees_select" on employees
    for select
    using (
        user_id = auth.uid()
        or business_id in (
            select id from businesses where owner_id = auth.uid()
        )
    );

-- Only owner can add employees (but backend uses service_role anyway)
create policy "employees_insert" on employees
    for insert
    with check (
        business_id in (
            select id from businesses where owner_id = auth.uid()
        )
    );

-- Only owner can update employee records
create policy "employees_update" on employees
    for update
    using (
        business_id in (
            select id from businesses where owner_id = auth.uid()
        )
    );


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. SERVICE_POSTS
-- ─────────────────────────────────────────────────────────────────────────────
alter table service_posts enable row level security;

drop policy if exists "posts_select" on service_posts;
drop policy if exists "posts_insert" on service_posts;
drop policy if exists "posts_update" on service_posts;

-- Open posts are readable by any authenticated user;
-- client can also see their own posts regardless of status
create policy "posts_select" on service_posts
    for select
    to authenticated
    using (
        status = 'open'
        or client_id = auth.uid()
    );

-- Only clients can create posts
create policy "posts_insert" on service_posts
    for insert
    with check (auth.uid() = client_id);

-- Only the owning client can update/cancel their post
create policy "posts_update" on service_posts
    for update
    using (auth.uid() = client_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. INTERESTS
-- ─────────────────────────────────────────────────────────────────────────────
alter table interests enable row level security;

drop policy if exists "interests_select" on interests;
drop policy if exists "interests_insert" on interests;
drop policy if exists "interests_update" on interests;

-- Business sees interests they expressed; client sees interests on their posts
create policy "interests_select" on interests
    for select
    using (
        business_id in (select id from businesses where owner_id = auth.uid())
        or post_id   in (select id from service_posts where client_id = auth.uid())
    );

-- Only business owner can express interest
create policy "interests_insert" on interests
    for insert
    with check (
        business_id in (select id from businesses where owner_id = auth.uid())
    );

-- Status changes (accept/reject) come from our backend via service_role
create policy "interests_update" on interests
    for update
    using (
        -- client can accept/reject interests on their posts
        post_id in (select id from service_posts where client_id = auth.uid())
    );


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────
alter table bookings enable row level security;

drop policy if exists "bookings_select" on bookings;

-- Participants only: client, business owner, or assigned employee
create policy "bookings_select" on bookings
    for select
    using (
        client_id   = auth.uid()
        or business_id in (select id from businesses where owner_id = auth.uid())
        or employee_id in (select id from employees where user_id = auth.uid())
    );

-- All writes go through service_role (backend) — no direct insert/update policies needed


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. MESSAGES
-- ─────────────────────────────────────────────────────────────────────────────
alter table messages enable row level security;

drop policy if exists "messages_select" on messages;
drop policy if exists "messages_insert" on messages;

-- Only booking participants can read messages
create policy "messages_select" on messages
    for select
    using (
        booking_id in (
            select id from bookings
            where client_id = auth.uid()
               or business_id in (select id from businesses where owner_id = auth.uid())
               or employee_id in (select id from employees where user_id = auth.uid())
        )
    );

-- Participants can only send messages on their own behalf
create policy "messages_insert" on messages
    for insert
    with check (
        sender_id = auth.uid()
        and booking_id in (
            select id from bookings
            where client_id = auth.uid()
               or business_id in (select id from businesses where owner_id = auth.uid())
               or employee_id in (select id from employees where user_id = auth.uid())
        )
    );


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. PAYMENTS
-- ─────────────────────────────────────────────────────────────────────────────
alter table payments enable row level security;

drop policy if exists "payments_select" on payments;

-- Only the client or business owner of the booking can view payment details
create policy "payments_select" on payments
    for select
    using (
        booking_id in (
            select id from bookings
            where client_id = auth.uid()
               or business_id in (select id from businesses where owner_id = auth.uid())
        )
    );

-- All payment writes come through service_role only


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. REVIEWS
-- ─────────────────────────────────────────────────────────────────────────────
alter table reviews enable row level security;

drop policy if exists "reviews_select" on reviews;
drop policy if exists "reviews_insert" on reviews;

-- Business reviews are public; client reviews visible to participants only
create policy "reviews_select" on reviews
    for select
    to authenticated
    using (
        reviewee_type = 'business'          -- public business ratings
        or reviewer_id  = auth.uid()        -- own reviews
        or reviewee_id  = auth.uid()        -- reviews about you
    );

-- Only authenticated users can submit a review (business logic checked in API)
create policy "reviews_insert" on reviews
    for insert
    with check (reviewer_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 10. CANCELLATIONS
-- ─────────────────────────────────────────────────────────────────────────────
alter table cancellations enable row level security;

drop policy if exists "cancellations_select" on cancellations;

-- Only the booking's client or business owner can see cancellations
create policy "cancellations_select" on cancellations
    for select
    using (
        booking_id in (
            select id from bookings
            where client_id = auth.uid()
               or business_id in (select id from businesses where owner_id = auth.uid())
        )
    );

-- All cancellation writes go through service_role
