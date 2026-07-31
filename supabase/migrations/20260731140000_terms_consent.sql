-- Terms + privacy consent, recorded — 2026-07-31
--
-- The signup form never mentioned the Terms or the Privacy Policy: no checkbox,
-- no link, nothing. The app half is a real gate now (SignupScreen step 0, in
-- front of Continue AND both social buttons), and this is where the answer is
-- kept, so "did this account agree, and when" is a fact rather than a belief.
--
-- Nullable on purpose. Every account that existed before today has NULL, which
-- is the honest value — we genuinely do not know. Do not backfill it with a
-- timestamp; a fabricated consent record is worse than an absent one.
--
-- The backend writes this BEST-EFFORT (auth.py::_record_terms_acceptance): if
-- this migration has not been applied yet, signup still succeeds and the write
-- is logged and skipped. That is deliberate — a pending migration must never be
-- able to lock people out of creating an account.

alter table public.users
  add column if not exists terms_accepted_at timestamptz;

comment on column public.users.terms_accepted_at is
  'When this account affirmatively accepted the Terms of Service and Privacy Policy at signup. NULL = predates the consent checkbox (2026-07-31) or was created by a client that does not send it. Never backfill.';
