# STATUS — Current Project State

> Rewritten by Orchestrator at the end of every session. Single source of truth for right now.
> Absorbed from the old agent system on 2026-06-17.

## Active Project
swingby

## Repo Path
C:/Users/amrba/OneDrive/Desktop/AMR/CODE/Swingby

## Last Updated
2026-06-21 evening (🟢 D1 DONE — real welcome email delivered end-to-end via Resend + mobile signup fixes shipped)

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
- ~~**Email is silent (H4)**~~ ✅ **DONE 2026-06-21** — Resend live, smoke-tested signup → welcome email in inbox.
- **Mobile shows mock data (C7/C8/C9):** STATUS CLAIM IS STALE — code inspection 2026-06-21 shows Home/Nearby, Business Dashboard, Chat ALL already call real APIs (`api.get('/businesses/nearby')`, `/messages/{id}`, `/businesses/me`). Verify end-to-end before declaring D2 done.
- **Upload broken on PostJob (NEW 2026-06-21):** `/uploads/image` returns 404 "Not Found" when phone tries to attach a photo. Backend route registration issue. Triage required.
- **No payment (H8):** Stripe not integrated — beta runs in TEST/sandbox mode; live Stripe is post-beta.
- **Missing backend endpoints (C4/C5/C6):** /api-keys, `/businesses/me/analytics` (still missing — Earnings + Business Analytics screens depend on it), /webhooks.
- **Placeholders:** Sentry DSN, hCaptcha secret still unset. Google Maps key IS set in `app.json` (`AIzaSyDW2h...`) and Places Autocomplete just got wired on PostJob.

## Blocked On
n/a (all blockers are build tasks, not external decisions)

## Open Broadcasts
- 2026-06-17 — Memory absorbed from old agent system into rebuilt kit; beta queue framed in PLAN.md

## Last Agent Run
2026-06-21 evening session (inline orchestrator, Kira-driven):
- 🟢 **D1 SHIPPED** — Kira created Resend account, verified swingbyy.com, generated API key, pasted `RESEND_API_KEY` + `RESEND_FROM_EMAIL` into Render env. Smoke test: `POST /auth/signup` → 200 → real welcome email landed in Kira's Gmail inbox.
- Mobile network fix: `mobile/.env` `EXPO_PUBLIC_API_URL` switched from stale LAN IP `http://10.0.0.53:8000` → `https://swingbyy-api.onrender.com`. Phones now reach backend regardless of Wi-Fi.
- Mobile signup hardening: `SignupScreen.js` — added uppercase/lowercase/digit client-side validation matching backend rules + visible hint under password field. Previously users got generic "Signup failed" with no clue why.
- Google Places Autocomplete wired on PostJob: `EXPO_PUBLIC_GOOGLE_PLACES_KEY` added (reusing existing Maps key); `PostJobScreen.js` now captures lat/lng from Place details (fetchDetails=true) and sends them with the post payload. Backend schema already had `lat`/`lng` fields. Address length-validation skipped when coords are set (Google validated). User to enable Places API on Google Cloud key — Maps SDK alone is not enough.

### Earlier today (separate session):
2026-06-21 BRIEF-post-launch-site.md (partial — orchestrator inline; overnight runner had been stuck on session-limit since 16:10 MDT):
- Created `web/launch/src/pages/HowItWorksBusinesses.jsx` — unblocked broken build (App.jsx imported missing file)
- Rewrote `Home.jsx` + `Home.module.css`: killed 3 fake testimonials → honest "stories landing post-beta" skeleton; fixed outdated "Alberta in 2025" copy → honest "live in Calgary today"; expanded trust strip 3 → 5 pillars (added Canadian-owned + 72h human dispute support); added 2-column How-It-Works (client + business); added app-preview section with `<AppMockupFrame>`; added "Live in Calgary" city block with SVG radius; added 8th category (Moving)
- Fixed `public/_headers` CSP: removed stale `api.swingbyapp.ca` + dev `localhost:8000`; added real prod hosts `swingbyy-api.onrender.com` + `api.swingbyy.com`
- Build green; lint clean; `npm audit` shows 0 vulns
- Deliverable: `claude/deliverables/post-launch-site-2026-06-22.md` — files touched, vulns, screenshot TODO, deploy reco

## Next Action
1. **D2 — back-to-back app testing on phone** (in progress this session):
   - Kira restart Expo with `npx expo start --clear`, reload Expo Go
   - Sign up as Client on phone → confirm via email link → log in
   - Sign up as Business on second account → confirm category + radius match
   - Post a job (Client) → verify it appears in Business `JobManagement` feed
   - Walk: quote → accept → assign employee → confirm date → complete → review
   - Capture exact wall where it breaks (if it does) for follow-up
2. **Fix `/uploads/image` 404** — PostJob photo attach broken. Triage backend route registration.
3. **Combine date + time picker** in PostJob Step 3 (Budget & timing) — use `mode="datetime"`. ~15 min.
4. **Kira (post-launch site cutover dependencies):**
   - Export 11 mobile app screenshots → `web/launch/public/screenshots/`
   - Calgary hero/city photo
   - Run Lighthouse mobile + confirm perf ≥ 90 / a11y = 100 before cutover
5. **Still Kira-only items from earlier:**
   - Supabase → Auth → enable "Confirm email"
   - Supabase → Auth URL Config → Site URL + redirect URLs
   - DNS DMARC on swingbyy.com
   - Enable Places API on Google Cloud key (so Places Autocomplete actually returns results)

## Security Gate
✅ passing (1 user-action item: enable HaveIBeenPwned leaked-password protection in Supabase Auth dashboard)

## Session End Signal
🟢 ACTIVE — BRIEF-reorg-mobile-web executing 2026-06-22; K1-PRECHECK-DIRTY cleared (Kira: commit WIP first). Three pre-reorg commits made before reorg work began.
