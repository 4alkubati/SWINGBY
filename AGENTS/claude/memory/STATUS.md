# STATUS — Current Project State

> Rewritten by Orchestrator at the end of every session. Single source of truth for right now.
> Absorbed from the old agent system on 2026-06-17.

## Active Project
swingby

## Repo Path
C:/Users/amrba/OneDrive/Desktop/AMR/CODE/Swingby

## Last Updated
2026-06-20 (BRIEF-auth-and-pages.md — all 5 tasks shipped)

## Current Phase
Beta launch prep — get a real tester onto the app, paying in sandbox

## Phase Status
🔄 in progress

## What's Working
- **Backend:** FastAPI deployed to Render (https://swingbyy-api.onrender.com), 15 API modules, auth, geo (Haversine), payments/escrow logic, pagination, rate limits, Sentry, GDPR export/erase.
- **Database:** 12 Supabase tables, all RLS-enabled; expiry cron live; seed accounts exist.
- **Web:** pre-launch site live at swingbyy.com (waitlist → Notion); admin dashboard scaffold built.
- **Mobile:** 30+ Expo screens scaffolded with UX primitives (skeletons, empty states, toasts, deep links, i18n, push wiring).
- **Security:** RLS clean, secrets server-only, .env not in git, CSP headers, admin role constrained.

## What's Broken (the real blockers — from ORCHESTRATOR_ISSUES.md)
- **Email is silent (H4):** Resend not configured → no signup/notification emails reach anyone. (Code is wired — `RESEND_API_KEY` not yet in Render env.)
- **Mobile shows mock data (C7/C8/C9):** Home/Nearby, Business Dashboard, and Chat are not wired to real APIs.
- **No payment (H8):** Stripe not integrated — beta runs in TEST/sandbox mode; live Stripe is post-beta.
- **Missing backend endpoints (C4/C5/C6):** /api-keys, /businesses/me/analytics, /webhooks — web screens 404 until built.
- **Placeholders:** Google Maps API key, Sentry DSN, hCaptcha secret all unset.

## Blocked On
n/a (all blockers are build tasks, not external decisions)

## Open Broadcasts
- 2026-06-17 — Memory absorbed from old agent system into rebuilt kit; beta queue framed in PLAN.md

## Last Agent Run
2026-06-20 BRIEF-auth-and-pages.md (all 5 tasks complete, no agent dispatched — orchestrator executed inline because tasks were tightly coupled):
- T1 Email-verify honesty: Dashboard.jsx, Signup.jsx, VerifyEmail.jsx fixed
- T2 Cascade migration applied to Supabase (`users_id_fkey_cascade`, v20260621031538)
- T3 Auth redirects built from `window.location.origin` in Signup, Login (magic link), VerifyEmail
- T4 Forgot-password full flow: backend redirect now → `https://swingbyy.com/reset-password` (was dead `swingby://auth/reset`); web + mobile both reach a live reset page
- T5 Page-completeness audit: `deliverables/page-completeness-audit-2026-06-20.md`; bonus: wired Contact form to real `POST /contact` (Resend) — was a console.log stub

## Next Action
Kira-only items (cannot be done in code):
1. Supabase → Auth → enable "Confirm email"
2. Supabase → Auth → URL Configuration → Site URL `https://swingbyy.com` + redirect URLs `https://swingbyy.com/**`, `swingby://**`
3. DNS: add DMARC record on `swingbyy.com` for inbox deliverability
4. Finish D1: set `RESEND_API_KEY` + `RESEND_FROM_EMAIL` in Render env (and now also `PASSWORD_RESET_REDIRECT_URL` if overriding default)

## Security Gate
✅ passing (1 user-action item: enable HaveIBeenPwned leaked-password protection in Supabase Auth dashboard)
