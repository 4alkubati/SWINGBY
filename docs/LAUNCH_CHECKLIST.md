---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build]
---
# SwingBy — Launch Checklist

30 items. Every one must be ✅ before public launch. If you can't tick a box, the public launch is not ready.

---

## Section 1 — Product (8 items)

| # | Item | Status |
|---|---|---|
| 1 | Mobile app builds for iOS via `eas build --profile production --platform ios` without warnings | ☐ |
| 2 | Mobile app builds for Android (same command, `--platform android`) without warnings | ☐ |
| 3 | Seed accounts (`client@swingby.app`, `business@swingby.app`) log in successfully on a real device | ☐ |
| 4 | End-to-end booking flow tested on real device: post → quote → accept → complete → review | ☐ |
| 5 | Push notification arrives within 30s of trigger on a physical device | ☐ |
| 6 | Deep links open the correct screen: `swingby://booking/<id>`, `swingby://invite/<code>` | ☐ |
| 7 | Pull-to-refresh on Home, MyJobs, Messages | ☐ |
| 8 | Crash + warning sweep on physical device (5+ min poking around) | ☐ |

## Section 2 — Backend (6 items)

| # | Item | Status |
|---|---|---|
| 9 | Render deploy of `swingby-api` is healthy: `/healthz` 200, `/health` 200 with DB connected | ☐ |
| 10 | All env vars set in Render dashboard (no missing `SUPABASE_SERVICE_KEY`) | ☐ |
| 11 | CORS allow-list scoped to `https://swingbyy.com` + production mobile origins, NOT `["*"]` | ☐ |
| 12 | Rate limits firing as expected (test signup 6 times in a minute — 6th should 429) | ☐ |
| 13 | Sentry receiving events (trigger a 500 from the admin panel, confirm it shows up) | ☐ |
| 14 | `/me/export` and `DELETE /me` work end-to-end (GDPR / PIPEDA) | ☐ |

## Section 3 — Database (4 items)

| # | Item | Status |
|---|---|---|
| 15 | `mcp__claude_ai_Supabase__get_advisors` shows 0 ERRORs and 0 NEW HIGH WARNs since 2026-05-28 baseline | ☐ |
| 16 | RLS enabled on all 12 tables (users, businesses, employees, service_posts, interests, bookings, payments, reviews, messages, cancellations, push_tokens, audit_log) | ☐ |
| 17 | Pro tier upgrade for Supabase (or a confirmed weekly `pg_dump` plan) | ☐ |
| 18 | Post-expiry cron is alive and pruning stale `service_posts` (check `pg_cron.job_run_details` table) | ☐ |

> **Item 15 status note (CARD-06, 2026-07-19):** as of this date, `get_advisors` returns 1 open security
> WARN — `auth_leaked_password_protection` (see item 20, Section 4 — same underlying issue, dashboard-only
> fix). 2 other WARNs (`function_search_path_mutable` on `public.update_disputes_updated_at`,
> `public_bucket_allows_listing` on the `job-photos` bucket) were fixed via
> `docs/card06_security_advisors_fix.sql`. Do not tick item 15 until item 20's dashboard toggle is also
> done and `get_advisors` is re-run clean.

## Section 4 — Security (5 items)

| # | Item | Status |
|---|---|---|
| 19 | No `SUPABASE_SERVICE_KEY` or JWT blob in `mobile/` or `web/` (grep clean) | ☐ |
| 20 | Auth dashboard: HaveIBeenPwned leaked-password protection ENABLED | ☐ |
| 21 | `handle_new_user()` execute permission revoked from anon + authenticated (hotfix applied 2026-05-28) | ☐ |
| 22 | App Store + Play Store privacy disclosures completed and match `docs/legal/PRIVACY_POLICY.md` | ☐ |
| 23 | Real Google Maps API key in EAS secrets (`GOOGLE_MAPS_API_KEY`), placeholder replaced | ☐ |

## Section 5 — Legal + comms (4 items)

| # | Item | Status |
|---|---|---|
| 24 | `docs/legal/PRIVACY_POLICY.md` reviewed by a Canadian lawyer (or accepted as-is for soft launch) | ☐ |
| 25 | `docs/legal/TERMS_OF_SERVICE.md` reviewed | ☐ |
| 26 | Public privacy + terms pages live at `https://swingbyy.com/privacy` and `/terms` | ☐ |
| 27 | CASL footer on every email (physical address + unsubscribe link) | ☐ |

## Section 6 — Ops + analytics (3 items)

| # | Item | Status |
|---|---|---|
| 28 | Plausible (or GA4) firing on `swingbyy.com` — confirmed in dashboard | ☐ |
| 29 | GitHub Actions green on `main` (backend.yml + mobile.yml both passing) | ☐ |
| 30 | Launch emails 1, 2, 3 drafted in your transactional provider with `{{merge tags}}` resolved | ☐ |

---

## How to use this list

- Print or paste this somewhere visible. Tick boxes as you go.
- Anything still ☐ on launch eve = postpone launch by one week. No exceptions for items 9, 10, 19, 20, 21 — those are non-negotiable.
- Re-run items 12, 13, 15, 28 within 24 hours of launch and again 48 hours after to catch regressions early.

---

## Post-launch — first 72 hours

| Hour | Watch |
|---|---|
| 0-6 | Sentry error rate; Render CPU + RAM; Supabase connections count |
| 6-24 | Signup conversion (% of waitlist who actually create an account); first booking happens? |
| 24-48 | Time-to-first-quote on real client posts; cancellation rate; review submission rate |
| 48-72 | Day-2 retention; mobile crash-free rate (Sentry); average API latency p95 |

If any of these graphs hockey-stick the wrong way, page yourself.

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]

**Related:** [[2026-07-19]]
<!-- graph-wire:end -->
