# Phone retest — 2026-08-19

Build under test: _______________   ledger @ `29692db`

Walk the app once. For each check write **PASS** (behaves correctly) or
**FAIL** (still wrong), and for a FAIL add one line on what you actually saw.
Photograph anything that fails into `~/brain/inbox/debugging/`.

---

## A. Confirm the fixes actually landed (74)

These are marked fixed in code but **not yet confirmed on a device**.
A FAIL here is the most valuable result in the sheet — it means a fix
did not survive the trip to the phone, which has now happened once.

### SB-0007 — Business dashboard renders hardcoded English literals in every locale

- **do** Open the business Dashboard with the language badge reading EN. Section headers render as 'НАСТУПНА РОБОТА', 'Немає запланованих робіт', 'переказано вам', 'ГРОШІ В РУСІ', 'На депонуванні', 'Переказано', while 'Good evening', 'THIS WEEK', 'TODAY', 'RATING' and the tab bar stay English.
- **PASS if** 17 new dashboard.* keys translated into en/fr-CA/ar/uk, and every literal call site routed through i18n.t()
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0008 — Language badge reads EN while Ukrainian is the checked selection

- **do** Settings -> Language. Set Ukrainian, back out to Settings, read the chip on the Language row. Then set Arabic and read it again. Then English.
- **PASS if** the chip reads UK for Ukrainian, AR for Arabic, EN for English, FR for French — always matching the checkmark in the sheet, and still matching after force-quitting and relaunching the app
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0011 — Rate limiter is keyed on the attacker-controlled X-Forwarded-For header — every per-IP limit is bypassable

- **do** Start the backend locally, then send N requests to /auth/login with a rotating X-Forwarded-For header and observe that no 429 is ever returned.
- **PASS if** Stop deriving the limiter key from a client-controlled header: set an explicit trusted-proxy list (--forwarded-allow-ips <render CIDR>) or key on the authenticated user id; use the SAME derivation as app/api/auth.py:_remote_ip.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0012 — slowapi default_limits never fires — no SlowAPIMiddleware registered, so undecorated routes have no rate limit at all

- **do** Send 150 requests to an undecorated route (GET /auth/me or POST /uploads/image) and observe zero 429 responses.
- **PASS if** Add SlowAPIMiddleware in main.py so default_limits applies, or delete default_limits so it stops claiming a control that is not there. Decorate the upload routes explicitly either way. Do this AFTER the key_func fix, or the new global limit inherits the same XFF bypass.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0013 — The M-05 fix silently rejects every declared image/heic upload — allowlist and sniff table disagree in committed code

- **do** On an iPhone, attach a photo to a job post / chat / proof-of-work upload against committed code — it 400s.
- **PASS if** Land the WIP image_sniff change. Add a test that walks ALLOWED_CONTENT_TYPES and asserts every entry has a _DECLARED_TO_SNIFFED key so the two tables cannot drift again — same for ALLOWED_AUDIO_CONTENT_TYPES vs audio_sniff.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0039 — Production waitlist form is blocked by its own CSP — connect-src omits api.swingbyy.com

- **do** see the ledger
- **PASS if** Add `https://api.swingbyy.com` to connect-src in web/pre-launch/public/_headers:12 and redeploy the Pages project. (web/launch/public/_headers:8 already lists it — copy that entry.) Then submit the real form once and confirm a row lands in the Notion waitlist DB.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0001 — Quote thread header says 'pending payment' while the accepted card below it says 'paid'

- **do** Client accepts a quote and pays. Open the message thread with the business. The booking summary card at the top of the thread reads 'pending payment - $180' while the system card directly beneath it reads 'Accepted - $180 paid'.
- **PASS if** Refresh/derive the thread header's payment state from the same source the accepted-quote card uses, or map 'pending_payment' to a paid label once escrow_held > 0.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0003 — Business setup trades do not populate 'Services & pricing' — a categorised business shows 'No services listed yet'

- **do** Business completed onboarding with category 'Moving'. My Business -> SERVICES & PRICING shows 'No services listed yet' with the subtitle 'The trades you picked during setup show here.'
- **PASS if** Either read the section from the same field onboarding writes, or change the empty-state copy so it stops promising something the screen cannot deliver.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0005 — Owner's own review renders on the business public profile as a Swingbyy review

- **do** View Amr's Moving Company public profile. Under SWINGBYY REVIEWS a 5-star review by 'Amr' reading 'Really loved their services.' is shown, and the business owner is also named Amr (TEAM shows 'Amr - Owner'). Rating reads 5.0 from 1 review.
- **PASS if** Reject a review whose reviewer_id is the reviewee business's owner_id (or any active employee of it) at POST time, and exclude such rows from avg_rating.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0006 — 'Propose a time' CTA shown for bookings whose date is already confirmed

- **do** Business -> Jobs -> Needs action. Two bookings from the same client both show a 'Propose a time' pill, though the client-side thread for that booking (Img1) shows the booking as CONFIRMED with a date of Sun, Aug 9, 11:36 PM.
- **PASS if** Have the Needs-action list gate the 'Propose a time' pill on the same field the client's CONFIRMED badge reads.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0009 — A booking reaches 'Job complete' with zero proof-of-work photos

- **do** Booking Details for a completed booking: the timeline shows Date confirmed -> On the way -> Pro arrived -> Job started -> Job complete, while the Proof of work section reads 'No photos yet', 'No before photos yet', 'No after photos yet'.
- **PASS if** Decide the policy first: either require at least one after photo before 'mark done' is accepted, or surface 'no proof submitted' prominently in the client's approve/dispute prompt. Do not leave it silent.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0014 — GET /businesses/* returns the full row — Stripe Connect id, customer id, subscription id and license number — to any authenticated user in bulk

- **do** Authenticate as any client and GET /businesses/?limit=100; inspect the JSON for stripe_* and license_number fields.
- **PASS if** Replace the four select('*') calls with an explicit public column list; keep the wide select only on the owner-scoped GET /businesses/me path.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0015 — businesses.logo_url still accepts metadata/loopback URLs — the M-04 fix never reached this sink

- **do** Call _validate_logo_url (or PATCH a business logo_url) with http://169.254.169.254/latest/meta-data/ — it is accepted.
- **PASS if** Replace the body of _validate_logo_url with a call to url_safety.validate_public_https_url, mapping UnsafeUrl to ValueError exactly as auth.py:245-247 does. Add the businesses/employees payloads to the parametrized list in tests/test_pentest_mediums.py.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0016 — employees.avatar_url has no URL validation at all — accepts javascript: and cloud-metadata URLs

- **do** POST /employees/ as a business owner with avatar_url=javascript:alert(1) — accepted and stored.
- **PASS if** Add @field_validator('avatar_url', mode='before') -> url_safety.validate_public_https_url mirroring auth.py:235-247. Consider hoisting that validator into url_safety as a reusable pydantic validator so a fourth sink cannot be added without it.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0017 — Brute-force guard's per-IP arm reads the spoofable X-Forwarded-For — 30 spoofed failures lock out any chosen IP

- **do** Send 30 failed logins with X-Forwarded-For: <victim IP>, then attempt a genuine login from that IP — refused.
- **PASS if** Derive the client address once from a trusted-proxy-aware helper shared with the limiter. At minimum validate _remote_ip's output with ipaddress.ip_address() and return 'unknown' on failure (login_guard already skips the IP arm for 'unknown'); consider taking the LAST hop rather than the first.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0024 — The "anon" Supabase auth client silently falls back to the SERVICE-ROLE key when SUPABASE_KEY is empty — which is the state of backend/.env today

- **do** see the ledger
- **PASS if** Make the fallback impossible instead of silent. Either (a) raise at import when neither SUPABASE_KEY nor SUPABASE_PUBLISHABLE_KEY resolves — the anon key is not optional once a separate auth client exists — or, if a single-key deployment must keep working, (b) keep the fallback but emit `logger.critical` naming the exact consequence and add SUPABASE_KEY to config.py `_REQUIRED`. Also add SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY to the `_OPTIONAL` inventory (both are alias sources today and appear in neither list), and have tools/backfill_geocode.py import app.config before app.supabase_client so the alias runs.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0025 — render.yaml declares 7 env vars while the backend reads 39 — every payment, email, captcha and error-reporting secret is absent from the only committed deploy manifest

- **do** see the ledger
- **PASS if** Add every production-required var to render.yaml with `sync: false` (name declared, value dashboard-held) so the blueprint is a complete inventory without carrying secrets. At minimum: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL, HCAPTCHA_SECRET, HCAPTCHA_SITEKEY, SENTRY_DSN, GOOGLE_MAPS_API_KEY, HEALTH_DIAGNOSTICS_TOKEN. If a var is deliberately dashboard-only, say so in a comment in render.yaml rather than omitting it.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0026 — .gitignore does not cover .env.production / .env.staging / .env.preview — a backend prod env file would be committed silently

- **do** see the ledger
- **PASS if** Add a broad ignore plus explicit negations for the two files that are tracked on purpose:
    .env.production
    .env.staging
    .env.preview
    !mobile/.env.production
    !web/pre-launch/.env.production
and add a one-line comment on each negation stating that the file must contain only public values (API URL, client Sentry DSN, feature gate) — which is true of both today.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0027 — backend/ has no .env.example — the only backend env documentation is a 6-line block in RUNNING_LOCALLY.md that names a variable the code never reads and omits 30 it does

- **do** see the ledger
- **PASS if** Restore backend/.env.example listing every name from config.py `_REQUIRED` + `_OPTIONAL` plus the 23 currently-undeclared vars, with placeholder values only and a one-line purpose comment each (marking which are secrets). Add those 23 to `_OPTIONAL` so config.py becomes the machine-checkable inventory. Fix docs/RUNNING_LOCALLY.md to point at the example file instead of duplicating a stale subset, and drop the dead AWS_BUCKET line.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0031 — axios 1.16.1 ships in the mobile app, the live swingbyy.com site and web/admin — 10 published advisories including prototype pollution that alters request construction

- **do** see the ledger
- **PASS if** Bump axios to >=1.17.1 (1.19.0 current) in all three lockfiles: `npm install axios@latest` in mobile/, web/pre-launch/ and web/admin/. No manifest change needed — ^1.7.7 already allows it. DO-NOT-BLIND-BUMP caveat: this is the auth and payments transport, so after bumping run the targeted mobile tests rather than trusting the semver range.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0032 — react-router open redirect + XSS unpatched in all three web apps, while docs/SECURITY.md records the fix as complete

- **do** see the ledger
- **PASS if** web/pre-launch: react-router-dom to ^7.18.2. web/launch and web/admin: to ^6.30.6 (patch bump, no major migration). Then rewrite docs/SECURITY.md:22 to name the version that is actually installed, and date it — a checklist row that names a version rots the moment a new advisory lands against that version.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0033 — `npm audit` runs in CI for exactly one app and it is the one that is never deployed; mobile CI passes --no-audit explicitly

- **do** see the ledger
- **PASS if** Add a `security-audit` job to web-ci.yml over the same [pre-launch, admin] matrix, running `npm audit --audit-level=high`. Add an equivalent to mobile.yml as a separate job (leave --no-audit on the install step; it is about install noise, not the gate). Then correct docs/SECURITY.md:21 to list which apps are actually covered.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0034 — Backend has no dependency lock at all — 10 of 15 runtime deps are unpinned and the Dockerfile resolves them at image-build time

- **do** see the ledger
- **PASS if** Generate a hash-pinned lock (`pip-compile --generate-hashes` from a requirements.in, or uv) and have both the Dockerfile and backend.yml install from it with --require-hashes. Keep requirements.txt as the human-edited input. Dependabot's existing pip entry (dependabot.yml:3) will then produce reviewable single-package PRs instead of silent drift.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0035 — Every CI and deploy workflow pins Node 20, which reached end-of-life on 2026-04-30 — 110 days ago

- **do** see the ledger
- **PASS if** Move all 8 pins to '22' (active LTS through 2027-04-30) in one change and let CI tell you what breaks. Also check the Cloudflare Pages build image Node version for the pre-launch project — that is a dashboard setting these workflows do not control.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0042 — Stripe Connect account ids on `businesses` are readable by any authenticated Supabase JWT — the 2026-07-20 column REVOKE was never extended to the 2026-08-03 columns

- **do** see the ledger
- **PASS if** Add a migration: `revoke select (stripe_connect_account_id, connect_disabled_reason, connect_requirements_due, connect_synced_at) on public.businesses from authenticated;` and add a standing rule that any new column on `businesses` is revoke-by-default.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0043 — `push_tokens` and `audit_log` are written by the API but have no CREATE TABLE and no RLS statement anywhere in the repository

- **do** see the ledger
- **PASS if** Add a migration that creates both tables with `enable row level security` and service-role-only access (no `authenticated` policy), matching the pattern in 20260806040000_payouts_rls.sql. Then confirm the live tables against it.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0044 — Schema split-brain: the `stripe_events` idempotency table the webhook hard-depends on lives only in docs/, outside the migration pipeline

- **do** see the ledger
- **PASS if** Move every docs/*.sql that defines a live table or policy into supabase/migrations/ with a timestamp reflecting when it was actually applied (guarded with IF NOT EXISTS / drop policy if exists so re-application is a no-op), and leave behind only genuinely one-off backfills.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0045 — /healthz — Render's healthCheckPath — is a hardcoded 200 that cannot fail, so a deploy with broken Supabase credentials is promoted as healthy

- **do** see the ledger
- **PASS if** Either point render.yaml:18 at /health, or give /healthz a cheap cached readiness signal (e.g. the result of the last Supabase probe, refreshed at most once every N seconds) so it can return 503. Keep the response body free of internals either way.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0046 — hCaptcha is a one-way switch that breaks 100% of signups — the backend enforces it but no client ever sends a token

- **do** see the ledger
- **PASS if** Either render the hCaptcha widget in the web signup form and add hcaptcha_token to the mobile signup payload before anyone sets HCAPTCHA_SECRET, or replace the guard with a warn-and-allow path plus a startup CRITICAL log; and correct web/launch/docs/security-deployment.md:119, which currently overstates the state.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0047 — Backend integration SDKs are entirely unpinned with autoDeploy on and no lockfile — Supabase, FastAPI, httpx and notion-client float to latest on every build

- **do** see the ledger
- **PASS if** Pin every line to a compatible range (>=X,<X+1) at the versions currently installed in backend/.venv, and commit a hash-pinned lockfile that the Dockerfile installs from.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0048 — web/launch's Supabase client is the unguarded version that blanked swingbyy.com on 2026-08-04 — the fix landed only in web/pre-launch

- **do** see the ledger
- **PASS if** Copy web/pre-launch/src/lib/supabase.js's guarded pattern (isSupabaseConfigured + deferred failure at the auth call sites) into web/launch/src/lib/supabase.js before the cutover.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0053 — web/pre-launch — the only app in production — has 6 HIGH npm vulnerabilities and no CI audit step; the audit gate exists only on the app that is never deployed

- **do** see the ledger
- **PASS if** Add a `security-audit` job to web-ci.yml mirroring web-launch-ci.yml's, over the [pre-launch, admin] matrix, and run `npm audit fix` in web/pre-launch (all six are non-breaking per npm).
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0056 — The backend secret scan only runs when web/launch changes, so it did not run for the 19-file security commit it was meant to protect

- **do** see the ledger
- **PASS if** Move the secret scan into its own workflow with no `paths:` filter (or add a scan job to backend.yml covering backend/app/). web-ci.yml's `Secret Scan (web)` job already has the right shape — it just needs a sibling that always runs.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0057 — web-launch CI has been red on `main` since 2026-08-05 — three merges landed on top of a standing failure

- **do** see the ledger
- **PASS if** cd web/launch && npm audit fix (js-yaml and nanoid are non-breaking; leave react-router alone — its fix needs --force and a v7 major bump).
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0058 — web-prelaunch Deploy reports FAILURE on every successful production deploy — the alarm on the only workflow that ships the live site is permanently red

- **do** see the ledger
- **PASS if** Point the verify step at the Pages deployment URL wrangler prints (e.g. https://<hash>.swingby-prelaunch-1pv.pages.dev), which is not behind the apex's bot protection, instead of https://swingbyy.com. Do NOT delete the assertions — they exist because a backwards cancellation ladder went live once.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0059 — web CI builds the production site with a different API host than the deployed bundle uses, so a green run does not validate the shipped configuration

- **do** see the ledger
- **PASS if** Drop the VITE_* env block from web-ci.yml's pre-launch leg so the CI build reads .env.production exactly as the deploy does. If web/admin genuinely needs build-time vars, scope them to that matrix leg only.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0060 — No web app contains a single test file; every web CI test step is a silent no-op or a stub that is never invoked

- **do** see the ledger
- **PASS if** Either add vitest + a smoke test per app and wire `test` scripts (then web-ci.yml's --if-present picks them up with no workflow change, as its comment intends), or at minimum change web/launch's stub from `echo` to `exit 1` so the absence is loud rather than green.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0065 — backend/tests/test_smoke_prod.py hits the live production API on every CI run — the "skipped by default" it documents was never implemented

- **do** see the ledger
- **PASS if** Add backend/pytest.ini with `[pytest]` / `markers = smoke: hits a deployed environment` and `addopts = -m "not smoke"`, so `pytest -m smoke` opts in explicitly. Separately, flip test_swagger_docs_available to assert 404 in production (or delete it) so it does not fight the docs lockdown.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0066 — docs/API.md documents 51 endpoints against a 144-endpoint API, and 7 of the documented routes do not exist

- **do** see the ledger
- **PASS if** Regenerate the route list from app.openapi() rather than hand-maintaining it; at minimum correct the 7 phantom routes and add the moderation, disputes, payouts, proof-of-work and social-auth sections. Consider adding the verify command above as a pytest so the doc cannot drift silently again.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0067 — docs/SECURITY.md claims "All routes auth-protected — 2 intentionally open" while 11 route handlers take no auth dependency, including all four social-auth endpoints

- **do** see the ledger
- **PASS if** Rewrite the row to state the real count and link the enumeration; better, add a pytest that walks app.routes, asserts the set of dependency-free paths equals a hardcoded allowlist, and fails when a new unauthenticated route appears.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0069 — docs/swingby_database_schema.md — the schema authority CLAUDE.md points at — is missing 16 tables, including both moderation tables

- **do** see the ledger
- **PASS if** Regenerate the doc from supabase/migrations/*.sql (and note in it that the 10 core tables were created via MCP, not migrations, which is why they have no CREATE TABLE to scrape). Also update CLAUDE.md:58 — "10 Tables + booking_events + booking_photos" understates the schema by ~20 tables.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0070 — web/launch builds production sourcemaps with full original source embedded and deploys the directory verbatim to Cloudflare Pages

- **do** see the ledger
- **PASS if** Set `sourcemap: mode === 'production' ? 'hidden' : true` so Sentry can still consume them without a //# sourceMappingURL comment, and add a `find dist -name '*.map' -delete` step to web-launch-deploy.yml before the publish (or set sourcemaps.filesToDeleteAfterUpload in the Sentry plugin).
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0071 — login_guard.prune_attempts() has no caller anywhere — the migration's own COMMENT promises a 7-day retention sweep that nothing executes

- **do** see the ledger
- **PASS if** Either add `@router.post("/sweeps/login-attempts")` in api/admin.py mirroring the two existing sweeps, or make it self-healing on read the way approvals.settle_if_due is (prune opportunistically inside record_failure). Simplest alternative: implement retention in SQL with a pg_cron job in the same migration and delete the Python function, so the COMMENT is true by construction.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0075 — STALE/WRONG — docs/SECURITY.md's committed refresh-token retention policy is not enforced: the prune runs only from an admin-only endpoint and there is no scheduler

- **do** see the ledger
- **PASS if** Either call prune_refresh_usage() from a client-scoped path with its own throttle (it is cheap and idempotent), or move it behind the same pg_cron that already runs hourly on Supabase, or correct the doc to say the prune is manual. The claim and the code have to agree.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0086 — node_modules is committed as an ABSOLUTE symlink for two web apps — breaks every clone, worktree and CI runner but this box

- **do** git ls-tree HEAD web/pre-launch/ | grep node_modules   # mode 120000, an absolute path
- **PASS if** git rm --cached the two symlink entries, add node_modules/ to .gitignore, and let npm create the real directory. If the symlink existed to save disk, use npm workspaces or a shared store (pnpm) rather than a path committed into the repo.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0002 — Business profile-completeness hint is truncated mid-sentence with no way to read it

- **do** Log in as a business, open My Business. The completeness card reads '80% - Add a description t...' and clips. The remaining instruction is unreachable.
- **PASS if** Allow the hint to wrap to two lines, or make the whole card tap through to the field it names.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0004 — Public-profile preview shows a back arrow underneath the 'Done' preview banner — two conflicting exits

- **do** My Business -> Preview public. The purple 'Previewing your public profile / Done' banner appears, and a normal screen back arrow renders directly below it.
- **PASS if** Hide the screen back arrow while previewing; 'Done' is the exit.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0010 — Booking timeline logs 'Date confirmed' four hours before the events it precedes, with a posting time in the future

- **do** Booking Details timeline reads 'Date confirmed / Time set at posting: Sun, Aug 16, 10:13 PM / Logged 1:19 AM', then On the way 1:21 AM, Pro arrived 1:21 AM, Job started 1:27 AM, Job complete 1:28 AM.
- **PASS if** Show the date on Logged rows that cross a day boundary, and label the scheduled time distinctly from the event log.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0018 — M-02 (rate limit on POST /messages/) is the only pentest fix with no regression test

- **do** Delete the @limiter.limit line from messages.py:670 and run the full backend suite — it still passes.
- **PASS if** Add a test to test_pentest_mediums.py that posts 61 messages and asserts the 61st is 429, mirroring how the other four tests pin their own payloads.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0019 — WIP login lockout is fail-open — a PostgREST outage silently disables brute-force protection with no alert

- **do** Make PostgREST unreachable and attempt more than MAX_FAILURES_PER_EMAIL failed logins — no lockout occurs and nothing alerts.
- **PASS if** Nothing blocking. Add an alert on the login_guard.count_failed log line so a silent fail-open is visible, and a docstring sentence on the tradeoff so the next reader does not rediscover it as a bug.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0020 — M-01 residual: redirect allowlist matches a scheme PREFIX, so a bare-scheme env value re-opens auth-code harvesting

- **do** Set SOCIAL_AUTH_REDIRECT_PREFIXES=exp:// and pass redirect_to=exp://attacker.host/--/auth-callback — accepted.
- **PASS if** Confirm the env var is unset in production. If Expo Go against the deployed API is needed, set the full prefix (exp://10.0.0.168:8081/--/) rather than the bare scheme, and refuse any configured prefix that is scheme-only.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0021 — Production CORS allowlist unconditionally includes localhost:5173 and :3000 with allow_credentials=True

- **do** curl -D - <prod>/health -H 'Origin: http://localhost:5173' and observe the ACAO + ACAC headers.
- **PASS if** Wrap the two localhost defaults in `if not settings.IS_PRODUCTION:` so they exist on dev boxes only, exactly as API_ENABLE_DOCS already does.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0022 — 429 responses use an `error` key while every other API error uses `detail` — clients render an empty message

- **do** Trip any rate limit and inspect the 429 body — it has `error`, not `detail`.
- **PASS if** Register a custom RateLimitExceeded handler returning JSONResponse(429, {'detail': 'Too many requests. Try again in a moment.'}), matching the wording style of the login lockout in auth.py:_check_lockout.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0029 — EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is read by the app but set and documented nowhere — setting it (the obvious fix for the dead autocomplete) inlines the Maps key into the JS bundle

- **do** see the ledger
- **PASS if** Pick one and make it explicit. Either (a) drop the EXPO_PUBLIC_GOOGLE_MAPS_API_KEY fallback and keep exactly one bundle-visible name (EXPO_PUBLIC_GOOGLE_PLACES_KEY), documenting in mobile/.env.example that it is public-by-design and MUST be a separate, Places-only, referrer+quota-restricted key — never the same key as GOOGLE_MAPS_API_KEY; or (b) if the fallback stays, document the variable in mobile/.env.example with that same warning and add it to the D12 restriction-check row. Either way the app-side Places key and the native Maps key must not be the same credential, since only one of them is protected.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0030 — Web .env.example drift: two vars used but undocumented, two documented but never read

- **do** see the ledger
- **PASS if** Add VITE_SENTRY_DSN and VITE_PRELAUNCH_GATE to web/pre-launch/.env.example (with the gate's true/false semantics spelled out). In web/launch/.env.example either delete VITE_HCAPTCHA_SITEKEY and VITE_PLAUSIBLE_DOMAIN or annotate them as reserved-and-not-yet-wired.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0036 — Dev-tooling CVEs in the backend venv: sqlparse 0.5.5 carries 4 advisories, and CI hard-pins black to an advisory-affected version

- **do** see the ledger
- **PASS if** `pip install -U sqlparse` in backend/.venv (constraint already permits it). Bump .github/workflows/backend.yml:40 to black==26.3.1 or later — note that a black minor bump can reformat files, so run `black --check` locally first and land any reformat as its own commit.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0037 — stripe SDK is capped at <12 while 15.5.1 is current — four majors behind, and the ceiling means Dependabot cannot even propose the move

- **do** see the ledger
- **PASS if** Not a blind bump. Read the stripe-python 12/13/14/15 upgrade guides, raise the ceiling one major at a time, and gate each on the full booking-loop smoke test. If the answer is 'not now', record the deferral and a review date next to the pin so the ceiling is a decision rather than an accident.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0041 — Cloudflare waitlist Worker returns the raw Notion API error body to any anonymous caller — the exact leak its FastAPI twin documents having fixed

- **do** see the ledger
- **PASS if** In workers/waitlist/index.js:119-125 log errText and return a fixed `{detail: "Could not join the waitlist right now"}`; port the backend's length caps and the role whitelist from backend/app/api/waitlist.py:29-48. Redeploy with `wrangler deploy` from workers/waitlist/.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0049 — Production runs Python 3.11 while all local development and the 1208-test suite run 3.14

- **do** see the ledger
- **PASS if** Pick one version. Either bump backend/Dockerfile:1 to python:3.14-slim and re-run the suite against it, or pin the dev venv to 3.11 and correct CLAUDE.md:22.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0050 — CLAUDE.md documents a Notion CRM integration (notion_crm.py, NOTION_CRM_DB_ID) that was deleted and no longer exists

- **do** see the ledger
- **PASS if** Delete the CRM row from CLAUDE.md:34 (keep the Notion nudge-layer row above it, which is accurate) and drop the stale clause in analytics.py:30.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0051 — No runbook exists for deploying the production waitlist Worker or setting its NOTION_TOKEN secret

- **do** see the ledger
- **PASS if** Add a Worker section to docs/DEPLOY.md covering `cd workers/waitlist && wrangler deploy`, `wrangler secret put NOTION_TOKEN`, the route/zone binding, and how to verify with a GET returning 405; and note in workers/waitlist/wrangler.toml that NOTION_TOKEN is a secret, not a var.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0054 — The pass-3 WIP will fail Backend CI's lint job, and `test: needs: lint` means all 1170 backend tests are then skipped, not run

- **do** see the ledger
- **PASS if** Run `backend/.venv/bin/black backend/` and fix the two ruff errors in backend/scripts/seed_walkthrough.py (move the demo_dataset import to the top or add a scoped noqa; split the `print(...); return 1` onto two lines) before pushing. Separately, consider dropping `needs: lint` from the test job so a formatting nit cannot suppress the whole suite.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0061 — web-launch-ci.yml triggers on push to every branch, doubling every PR's runs; web-ci.yml and web-launch-ci.yml also lack concurrency groups

- **do** see the ledger
- **PASS if** Add `branches: [main]` under web-launch-ci.yml's push trigger, and add a `concurrency:` block to both web workflows matching backend.yml's shape.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0062 — No CODEOWNERS, no PR template, and the two web workflows declare no `permissions:` block

- **do** see the ledger
- **PASS if** Add `permissions: contents: read` to web-ci.yml and web-launch-ci.yml; add .github/CODEOWNERS and a PR template once branch protection exists to give them teeth.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0063 — tools/e2e_smoke.py is called mandatory by DISPATCH_GATE Layer 6 but runs in no workflow

- **do** see the ledger
- **PASS if** Add a job to backend.yml that boots uvicorn against a throwaway Postgres service container, seeds the two test accounts, and runs `python tools/e2e_smoke.py http://127.0.0.1:8000` — or, cheaper, extract the response-shape assertions into pytest so they run in the existing suite.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0072 — mobile/src/i18n.js comments still describe Arabic and French as untranslated skeletons — all four locales are at 100% key coverage

- **do** see the ledger
- **PASS if** Replace the Arabic header comment with the real status (fully translated; RTL handled by services/rtl.js) and rewrite the lane3/acceptChargesNow preamble to say the append-only structure is about merge conflicts, not about those keys being English-only — because they no longer are. Point both at src/__tests__/i18n-coverage.test.js as the live check.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0074 — STILL OPEN — the live pg_cron expires posts to a status the refund sweep is coded to skip, so escrow on an expired post can never be refunded

- **do** see the ledger
- **PASS if** Either add 'expired' to SWEEPABLE_STATUSES (the sweep is already idempotent — a zero-escrow row is skipped on the money, per the comment at :131), or drop the pg_cron status flip and let the sweep own the transition it already performs at expiry_sweep.py:168. Do not do neither: the docs currently claim both and the code assumes only one.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0078 — STALE/WRONG — docs/SECURITY.md 'RLS on all 10 tables' has been outgrown: 13 further tables carry their own RLS migrations and the row can no longer be read as coverage

- **do** see the ledger
- **PASS if** Change the row to a computed statement — 'RLS on every table in public' — and pair it with a verification query rather than a count that ages.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0079 — STILL OPEN — OPEN-2026-08-12 item 3: expo-splash-screen is still not installed and nothing holds the native splash across mount

- **do** see the ledger
- **PASS if** Install expo-splash-screen, add preventAutoHideAsync() at module scope in App.js and hideAsync() once fonts settle. It is a native module + prebuild change, so pair it with the next EAS build rather than doing it standalone.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0080 — STILL OPEN (mitigated) — DEC-5's recorded webhook gap is real: account.updated, payout.*, transfer.* are still ignored; reconcile-on-read is what saves it

- **do** see the ledger
- **PASS if** Update the DEC-5 row to record that the reconcile-on-read half is built (payouts.py:180/242/341), so this stops being re-investigated. Adding the webhook handlers is optional polish, not a gap.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0083 — STALE — OPEN-2026-08-12 item 4 (branch hygiene) has already drifted: 6 new undeleted branches, and the 'origin'-named branch it flagged is gone

- **do** see the ledger
- **PASS if** Delete the three branches whose PR is MERGED. Leave feat/d5-payouts-stripe-connect and fix/sweep-2026-08-15-rls-and-unwired-controls (closed-unmerged and open respectively).
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0085 — web/launch CSP has no frame-ancestors — clickjacking defence rests on the deprecated X-Frame-Options alone

- **do** grep -o "frame-ancestors[^;]*" web/launch/public/_headers  # returns nothing
- **PASS if** Add frame-ancestors 'none' to the CSP in web/launch/public/_headers, matching web/pre-launch.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0038 — Mobile's 19 'high' npm advisories are all build-tooling, not shipped code — but Expo SDK 54 / RN 0.81.5 drift has no owner at all

- **do** see the ledger
- **PASS if** Leave the ignore list alone. Instead schedule the Expo SDK upgrade explicitly — `npx expo install --check` in mobile/ reports exactly which pins Expo considers wrong for the installed SDK, and is cheap. Add a dated line to docs/SECURITY.md recording which SDK the app is on and when it was last reviewed, so 'Expo owns this' has a name and a date attached.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

### SB-0064 — Reconciliation: 8 Dependabot PRs and 1 security PR sit open and unmerged, and docs/DEPLOY.md's CI inventory is stale

- **do** see the ledger
- **PASS if** Triage the dependabot backlog (PR #159 first — it is a security fix); correct docs/DEPLOY.md:196; update the web-prelaunch-deploy.yml comment and consider changing its fallback default to the now-confirmed `swingby-prelaunch`.
- [ ] PASS  [ ] FAIL → what you saw: ______________________

---

## B. Does it still reproduce? (12)

### BLOCKER

**SB-0023 — Live Google Maps API key is in PUBLIC git history and was never rotated — the same key is in mobile/.env today**

- **do** see the ledger
- [ ] still broken  [ ] looks fixed now  → note: ______________

**SB-0052 — `main` has no branch protection and no rulesets — every workflow, including the live-site gate, is purely advisory**

- **do** see the ledger
- [ ] still broken  [ ] looks fixed now  → note: ______________

**SB-0073 — STILL OPEN — privilege escalation to platform admin is in no backlog document; its only fix is unmerged PR #159 and the migration is absent from the tree**

- **do** see the ledger
- [ ] still broken  [ ] looks fixed now  → note: ______________

### BROKEN

**SB-0055 — Dependabot covers no web app at all, and Dependabot security alerts are disabled repo-wide — nothing would ever have surfaced the live site's 6 highs**

- **do** see the ledger
- [ ] still broken  [ ] looks fixed now  → note: ______________

**SB-0068 — docs/SECURITY.md says the post-expiry cron is "Live on Supabase" — two source files state flatly that no scheduler exists in this deployment**

- **do** see the ledger
- [ ] still broken  [ ] looks fixed now  → note: ______________

**SB-0076 — STALE/WRONG — HUMAN-TODO D13 is still flagged 'BREAKING EVERY BUSINESS' but the 500 was fixed in committed code on 2026-08-14, which changes the DEC-7 decision underneath it**

- **do** see the ledger
- [ ] still broken  [ ] looks fixed now  → note: ______________

**SB-0077 — STILL OPEN — D19: www.swingbyy.com has no DNS record at all, confirmed live**

- **do** see the ledger
- [ ] still broken  [ ] looks fixed now  → note: ______________

### SLOPPY

**SB-0028 — Cloudflare account ID and the operator's account-name email remain in published git history — the .gitignore comment claims this was closed, but untracking does not purge**

- **do** see the ledger
- [ ] still broken  [ ] looks fixed now  → note: ______________

**SB-0040 — Production analytics is dead — deployed bundle contains no PostHog code, and DEPLOY.md still instructs operators to set VITE_PLAUSIBLE_DOMAIN**

- **do** see the ledger
- [ ] still broken  [ ] looks fixed now  → note: ______________

**SB-0081 — STILL OPEN — LAUNCH-BLOCKERS M4 (browser checkout fallback) is unchanged and was never re-tested as the doc asked**

- **do** see the ledger
- [ ] still broken  [ ] looks fixed now  → note: ______________

**SB-0082 — STILL OPEN — DEC-6 / M11 credit redemption remains gated off, unchanged since 2026-08-04**

- **do** see the ledger
- [ ] still broken  [ ] looks fixed now  → note: ______________

### POLISH

**SB-0084 — HUMAN-ONLY — 18 backlog items confirmed as still requiring dashboard access or a business decision no agent can make**

- **do** see the ledger
- [ ] still broken  [ ] looks fixed now  → note: ______________

---

## C. Anything else

Screens where something looked wrong that is not listed above. Name the
screen and what you expected — a screenshot into
`~/brain/inbox/debugging/` is enough.

1. ______________________________________________
2. ______________________________________________
3. ______________________________________________

---

## Feeding results back

```
# still broken
python tools/bugctl.py verified SB-0003 --result still-broken --note "<what you saw>"
# no longer reproduces
python tools/bugctl.py verified SB-0003 --result gone --note "confirmed on <build>"
# a fix survived to the device
python tools/bugctl.py note SB-0008 "device-confirmed on <build>"
```

