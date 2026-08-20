# SwingBy — Security Checklist

| Item | Status |
|---|---|
| RLS on every public table | ✅ **32/32 enabled**, verified against the live schema 2026-08-19. This row said "all 10 tables" and had been outgrown three times over (SB-0078) — the count is not the point, the coverage is. Re-check with `list_tables` rather than trusting the number here. |
| Supabase security advisors | ⚠️ 1 open — HIBP leaked-password protection disabled (dashboard-only toggle, Auth → Sign In / Providers → Password → "Leaked password protection" → Enable). 2 others (disputes trigger fn missing pinned `search_path`, `job-photos` bucket publicly listable) fixed 2026-07-19 via `docs/card06_security_advisors_fix.sql` (CARD-06). Verify live with `mcp__claude_ai_Supabase__get_advisors` before checking this row off — don't trust this line without re-running it. |
| No table open to anon | ✅ Zero anon policies |
| Service role key backend-only | ✅ Never in mobile/ or web/ |
| `.env` not in git | ✅ Confirmed via git ls-files |
| All routes auth-protected | ✅ **13 intentionally open**, not 2 (SB-0067). The authoritative list is generated into `docs/API.md` under "Public / unauthenticated" by `tools/gen_api_docs.py` — it is derived from each route's dependency tree, so it cannot drift the way this row did. Today: the 7 `/auth/*` pre-auth routes, `/contact/`, `/waitlist/`, `/health`, `/healthz`, `/google-reviews/callback` (OAuth) and `/payments/stripe/webhook` (signature-verified). Anything NEW appearing there is a finding. |
| Input validation on all models | ✅ Pydantic Field constraints + EmailStr |
| supabase_client hard-fails if key missing | ✅ RuntimeError at startup |
| Post expiry cron (hourly, pg_cron) | ✅ **LIVE — settled 2026-08-19 by querying `cron.job`** (SB-0068). `expire-service-posts`, schedule `0 * * * *`, active. Two auditors disagreed because eight places in the backend say "there is no scheduler in this deployment" — true of Python, false of the database. The job runs `expire_old_service_posts()`, which is ONLY `update service_posts set status='expired' where status='open' and expires_at < now()` — it moves no money. That is exactly why SB-0074 mattered: the refund sweep skipped 'expired', so a post the cron touched could never be refunded. Second job: `refresh-business-work-index`, `17 4 * * *`. |
| JWT expiry | ✅ 3600s default (free plan, not configurable) |
| Email confirmation | ⚠️ Check: Auth → Sign In / Providers → Email → "Confirm email" ON |
| AWS S3 bucket | ⚪ Not needed — using Supabase Storage instead |
| Supabase Storage bucket job-photos | ✅ Created 2026-06-15 — public read, 10 MB limit, images only |
| Image upload endpoint /uploads/image | ✅ backend/app/api/uploads.py — validates type+size, auth-protected |
| CSP headers (_headers for Cloudflare/Netlify) | ✅ web/launch/public/_headers |
| Admin role in DB constraint | ✅ wave-5-admin-role.sql applied, amrbasem37@gmail.com = admin |
| CI secret scan + npm audit | ✅ .github/workflows/web-launch-ci.yml |
| react-router-dom XSS (GHSA-2w69) | ✅ Upgraded to 6.30.4 |
| xlsx prototype pollution (no npm fix) | ✅ Replaced with ExcelJS |
| Refresh-token rotation + reuse detection | ✅ D7.4, 2026-08-14 — see the section below |
| Session revocation on password change | ✅ D7.4 — trigger on `auth.users`, `users.sessions_valid_after` |
| Upload content verified by magic bytes | ✅ D7.9 — `services/image_sniff.py`, not the declared type |
| `avatar_url` restricted to public https | ✅ D7.8 — `services/url_safety.py` |
| OAuth `redirect_to` path allowlisted | ✅ D7.5 — scheme *and* path, `auth.py::_validate_redirect` |
| Rate limit on `POST /messages/` | ✅ D7.6 — 60/minute |
| User text escaped before reportlab | ✅ D7.7 — `api/invoices.py`, Paragraph parses markup |
| `android:allowBackup` | ✅ D7.10 — `false` in `mobile/app.json` (needs a rebuild to take effect) |
| Google Maps API key restriction | ⚠️ D7.11 — **unverified.** Key ships in the bundle by design; confirm in Google Cloud Console that it is restricted by Android package name + SHA-1 and has a quota. Console access is not available to agents. |

---

## Refresh-token rotation policy

*Added 2026-08-14 to close D7.13 (pentest L-04), which was simply that this
section did not exist. The code fix is D7.4.*

**Rotation.** Supabase rotates the refresh token on every use. The API does not
issue its own tokens; it passes through to `supabase_auth.auth.refresh_session`.

**Reuse detection is ours, not Supabase's.** The engagement proved Supabase's
own reuse interval does not reject a replay: log in, refresh with `R0`, wait 65
seconds, refresh with `R0` again — it succeeded and issued a fresh access token.
So `backend/app/services/session_security.py` records the SHA-256 of every
refresh token the API issues and spends. Presenting a spent token again:

| When | What happens |
|---|---|
| within 60s of it being spent | allowed — a client that never persisted the rotated token, not an attacker |
| after 60s | **refused, and the account's sessions are revoked** |

**Sessions do not expire.** There is no idle timeout and no maximum session
age. A signed-in user stays signed in until they log out. This is a product
requirement, not an oversight — anything else is a worse experience than every
app SwingBy is compared to.

**Revocation.** `users.sessions_valid_after` is a watermark. Any access token
whose `iat` predates it is refused by `deps.py::_user_from_token`, and any
refresh token issued before it is refused by `/auth/refresh`. It is stamped by:

* a trigger on `auth.users`, when and only when `encrypted_password` changes —
  the reset flow runs client-side against Supabase and never reaches our
  backend, so a database trigger is the only place that sees every change;
* refresh-replay detection, above.

The watermark is NULL for every user until one of those fires.

**Retention.** `refresh_token_usage` rows are pruned after 30 days by
`session_security.prune_refresh_usage()`, called from the expiry sweep. The
tokens themselves are never stored — only their hashes.

That prune is **not scheduled** (SB-0075). This deployment has no scheduler, so
it runs only when the expiry sweep does: lazily via `GET /service-posts/my`, or
when an admin calls `POST /admin/sweeps/post-expiry`. Until one of those
happens the 30-day horizon is a policy nobody is enforcing. The same is true of
`login_attempts`, whose 7-day sweep is `POST /admin/sweeps/login-attempts`
(SB-0071). If either retention window needs to be a guarantee rather than an
intention, it needs a scheduler — that is a deliberate open decision, not an
oversight.
