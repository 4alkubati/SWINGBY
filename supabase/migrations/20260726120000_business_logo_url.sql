-- Business logo — the missing visual identity.
--
-- `businesses` had 25 columns and not one of them was an image: no logo_url,
-- no avatar_url, no image_url. Clients have `users.avatar_url` and employees
-- render off the same column, so a business was the only entity in the product
-- with no face — a name and a category in search results, on its own profile,
-- and on the home "Top rated near you" card.
--
-- One nullable text column, same contract as `users.avatar_url`: a public URL
-- into the existing public-read `job-photos` bucket, written by
-- POST /uploads/image. No new bucket, no new storage policy, no backfill.
--
-- NULL is the normal state, not an error state. Every surface that renders a
-- business falls back to the initials monogram tile (Avatar shape="tile",
-- accentMuted + accentText per POLISH-TIPS §8), which is what all of them
-- already showed before this column existed. On the day this ships every row
-- is NULL, so the fallback is the common path and nothing about it is a
-- placeholder for a missing image.
--
-- Additive and idempotent: no default, no NOT NULL, no constraint on existing
-- rows, so this cannot fail on or rewrite the live table. The API tolerates the
-- column being absent (see backend/app/api/businesses.py::_strip_missing_logo_
-- column) so code and migration can land out of order without 500ing a signup.

alter table public.businesses
    add column if not exists logo_url text;

comment on column public.businesses.logo_url is
    'Public URL of the business logo in the job-photos bucket. NULL = render the initials monogram tile. Written only by the owning owner via PATCH /businesses/{id}.';
