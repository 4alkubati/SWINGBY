-- businesses_logo_url.sql
-- Adds a public-facing logo URL to public.businesses.
--
-- LANE D (#6 business profile). BusinessProfileScreen's hero always rendered
-- initials because <Avatar name={business_name} /> was passed no source and no
-- logo upload path existed. This column stores the Supabase Storage URL (bucket
-- `job-photos`, same as user avatars via POST /uploads/image) that the owner's
-- new logo picker writes with PATCH /businesses/{id} {"logo_url": ...}.
--
-- Nullable, no default: a business without a logo keeps rendering initials.
-- Mirrors public.users.avatar_url (text, nullable).
--
-- Idempotent: safe to re-run.

ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS logo_url text;
