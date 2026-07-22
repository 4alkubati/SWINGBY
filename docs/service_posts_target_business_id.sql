-- Migration: add target_business_id to service_posts (LANE C — direct "Book now").
--
-- Written 2026-07-21 for the direct-to-business "Book now" flow. A nullable FK
-- to businesses.id. When set, the post is a direct quote request to exactly ONE
-- business (the "Book now" flow off a business profile) instead of an open
-- marketplace post:
--   * it is visible only in THAT business's feed (never leaks to others), and
--   * its category is derived from the target business, not asked of the client.
-- NULL = normal open-marketplace post — behaviour unchanged.
--
-- Additive, nullable, idempotent — no backfill needed. ON DELETE SET NULL so a
-- deleted business degrades the post back to an ordinary (untargeted) post
-- rather than cascade-deleting the client's job.
--
-- APPLIED to project ulnxapnsenzyddddldjt on 2026-07-22 via the Supabase MCP.
-- Verified against information_schema (column uuid/nullable, FK
-- service_posts_target_business_id_fkey -> businesses with delete_rule
-- SET NULL, partial index present). Raw SQL never registers in
-- supabase_migrations, so list_migrations will NOT show it.
--
-- RLS caveat (deliberately NOT changed here): docs/rls_policies.sql's
-- "posts_select" grants every authenticated user read on any status='open'
-- post, so it does not distinguish targeted posts. That is pre-existing and
-- harmless today — the app never talks to Supabase directly (service_role is
-- backend-only), and targeting is enforced in the API layer:
--   * GET  /service-posts/        — targeted posts appear only in the target's feed
--   * GET  /service-posts/{id}    — 404 for a business_owner who isn't the target
--   * POST /interests/            — 404 for a business_owner who isn't the target
-- Tightening posts_select belongs with the RLS lockdown work, not here.

ALTER TABLE public.service_posts
    ADD COLUMN IF NOT EXISTS target_business_id UUID
        REFERENCES public.businesses(id) ON DELETE SET NULL;

-- Partial index — the feed only ever filters on target_business_id when it is
-- non-null (the target-business branch of GET /service-posts/), so index just
-- the targeted rows.
CREATE INDEX IF NOT EXISTS idx_service_posts_target_business_id
    ON public.service_posts (target_business_id)
    WHERE target_business_id IS NOT NULL;

COMMENT ON COLUMN public.service_posts.target_business_id IS
    'LANE C direct-book: when set, this post targets exactly one business '
    '(visible only in that business''s feed, category derived from the '
    'business). NULL = open marketplace post.';
