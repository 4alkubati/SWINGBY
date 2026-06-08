-- Wave 5: Add 'admin' as a valid role in users.role CHECK constraint
-- Applied: 2026-06-08 via Supabase MCP

-- Drop the existing constraint (was: client, business_owner, employee)
ALTER TABLE public.users
  DROP CONSTRAINT users_role_check;

-- Re-add with 'admin' included
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
    CHECK (role = ANY (ARRAY['client'::text, 'business_owner'::text, 'employee'::text, 'admin'::text]));

-- NOTE: The admin role is intentionally NOT settable via the signup API.
-- auth.py validate_role only accepts 'client' and 'business_owner'.
-- Admin accounts must be set directly in the database by the SwingBy team.

-- Set founder admin (amrbasem37@gmail.com)
-- UPDATE public.users SET role = 'admin' WHERE email = 'amrbasem37@gmail.com';
-- (Already applied — commented out to prevent accidental re-run)
