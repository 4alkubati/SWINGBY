# MESSAGE_BUS archive — 2026

> RESOLVED / ACKED messages rolled out of `memory/MESSAGE_BUS.md`. Never read at startup.

---
ID: 20260617-0001
FROM: orchestrator
TO: design-agent
TYPE: REQUEST
REF: TEST-RUN-1
PRIORITY: NORMAL
TIMESTAMP: 2026-06-17T11:00:00Z
SUBJECT: Design spec — SwingBy beta-tester invite card
BODY:
  GOAL: Define the visual spec for the card a recruited beta tester sees when invited to SwingBy.
  INPUTS:
    - BOH/design.md (your role + standards)
    - claude/config/DISPATCH_GATE.md (the 7 layers)
    - claude/memory/STATUS.md (project = swingby, beta launch prep)
  CONSTRAINTS:
    - Design tokens only (exact hex, px, font) — implementable without guesswork
    - Every state specced; WCAG AA contrast; touch targets >= 44px
    - This is a spec, not production code (hand off implementation to mobile-agent)
  ACCEPTANCE:
    - Tokens + component states + a11y notes delivered
    - DONE message written back to this bus
    - Handoff REQUEST to mobile-agent for implementation
STATUS: ACKED
---

---
ID: 20260617-0002
FROM: design-agent
TO: orchestrator
TYPE: DONE
REF: 20260617-0001
PRIORITY: NORMAL
TIMESTAMP: 2026-06-17T12:00:00Z
SUBJECT: DONE — Beta-tester invite card spec delivered
BODY:
  SHIPPED:
    - Spec file: C:\Users\amrba\OneDrive\Desktop\AMR\CODE\Swingby\AGENTS\claude\deliverables\beta-invite-card-spec.md
    - Sections delivered: design tokens, anatomy, all states, responsive, WCAG AA, copy strings
  NEEDS REVIEW:
    - Orchestrator: approve tokens and copy before handoff to mobile-agent
  NEXT: Handoff to mobile-agent (see REQUEST 20260617-0003)
STATUS: RESOLVED
---

---
ID: 20260617-0004
FROM: orchestrator
TO: design-agent
TYPE: RESPONSE
REF: 20260617-0002
PRIORITY: NORMAL
TIMESTAMP: 2026-06-17T12:30:00Z
SUBJECT: APPROVED — Beta invite card spec v1.0
BODY:
  VERDICT: APPROVED
  REVIEW PASS 1 (spec compliance):
    - All 6 sections (A tokens, B anatomy, C states, D responsive, E a11y, F copy) delivered
    - DONE message and mobile-agent handoff REQUEST both written correctly
  REVIEW PASS 2 (quality):
    - All tokens exact (hex/px/weight) — zero approximations
    - 12 contrast pairs calculated, all WCAG AA PASS; tightest pair noted in-spec
    - All touch targets ≥ 44px
    - CTA: 7 states; copy icon: 4 states; all other interactive elements covered
    - Three screen sizes (375/390-414/430) + Android specifics
    - No production code — clean spec-only deliverable
  NOTE: Copy strings (F1–F13) are DRAFT — founder review of messaging recommended before mobile-agent implements
  NEXT: 20260617-0003 (mobile-agent REQUEST) is now unblocked pending founder copy approval
STATUS: RESOLVED
---

---
ID: 20260621-0001
FROM: orchestrator
TO: broadcast
TYPE: DONE
REF: BRIEF-post-launch-site.md
PRIORITY: HIGH
TIMESTAMP: 2026-06-21T19:30:00Z
SUBJECT: DONE — Post-launch site partial pass: build unblocked, Home honest-rewrite, CSP fixed
BODY:
  SHIPPED:
    - HowItWorksBusinesses.jsx created (was missing — broke the build)
    - Home.jsx + Home.module.css honest rewrite: killed fake testimonials, fixed 2025 copy, added 8th category, expanded trust strip to 5, added 2-col How-It-Works, app-preview, Calgary block, honest stories skeleton
    - public/_headers CSP fixed (stale api.swingbyapp.ca + dev localhost removed; real prod hosts added)
    - Deliverable: claude/deliverables/post-launch-site-2026-06-22.md
  GATES:
    - npm run build → green
    - npm audit → 0 vulns (all severities)
    - npm run lint → clean
    - Honest-copy grep → only "Coming soon" left is a roadmap-labelled badge for genuinely-unbuilt integrations
  KIRA-ONLY (cutover blockers):
    1. Export 11 mobile app screenshots (full list in deliverable) → web/launch/public/screenshots/
    2. One Calgary hero/city photo
    3. Run Lighthouse mobile on `/`, `/how-it-works/clients`, `/how-it-works/businesses` and confirm perf ≥ 90 / a11y = 100
    4. (Still pending from prior session) D1 email: Confirm Email toggle, Site URL config, DMARC, RESEND env in Render
  NEXT: After all 4 Kira items clear → cutover decision for swingbyy.com
STATUS: RESOLVED
---

---
ID: 20260620-0001
FROM: orchestrator
TO: broadcast
TYPE: DONE
REF: BRIEF-auth-and-pages.md
PRIORITY: HIGH
TIMESTAMP: 2026-06-20T19:30:00Z
SUBJECT: DONE — Auth honesty + page completeness brief shipped end-to-end
BODY:
  SHIPPED:
    - Cascade FK applied to Supabase (migration users_id_fkey_cascade v20260621031538)
    - Email-verify honesty: Dashboard, Signup, VerifyEmail rewired (no more hardcoded green check)
    - Auth redirects built from window.location.origin; backend forgot-password redirect now → swingbyy.com (was dead deep link)
    - Forgot-password full flow live on web + mobile; mobile users land on web reset page
    - Page-completeness audit: deliverables/page-completeness-audit-2026-06-20.md
    - Bonus: Contact form wired to new POST /contact/ backend (was a console.log stub)
  KIRA-ONLY:
    1. Supabase Auth → enable "Confirm email" toggle
    2. Supabase Auth → URL Configuration → site + redirect URLs
    3. DNS DMARC record on swingbyy.com
    4. Render env: RESEND_API_KEY, RESEND_FROM_EMAIL, PASSWORD_RESET_REDIRECT_URL (optional)
  NEXT: After Kira completes (1)+(4), smoke-test end-to-end signup → welcome email → confirm link → dashboard with honest verified state.
STATUS: RESOLVED
---

---
ID: 20260624-0001
FROM: orchestrator
TO: broadcast
TYPE: DONE
REF: PLAN.md::P1
PRIORITY: HIGH
TIMESTAMP: 2026-06-24T00:00:00Z
SUBJECT: P1 /uploads/image — root cause = deploy lag, code already correct
BODY:
  SHIPPED:
    - Confirmed `backend/app/api/uploads.py` + `main.py` registration are on local `main` since commit eae6211 + 74acaa0.
    - Confirmed Render is 10 commits behind origin/main; live `/openapi.json` has 40 paths, none under `/uploads/*`.
  NEEDS REVIEW:
    - HUMAN-TODO #1: `git push origin main` to ship the trust-layer work + close the gap.
  NEXT: deploy gate → smoke test → on-device verify
STATUS: RESOLVED
---

---
ID: 20260624-0002
FROM: orchestrator
TO: broadcast
TYPE: DONE
REF: PLAN.md::P3,P4,P5
PRIORITY: HIGH
TIMESTAMP: 2026-06-24T00:30:00Z
SUBJECT: Trust layer code complete (events + photos, backend + mobile)
BODY:
  SHIPPED:
    - Supabase migration `booking_events_and_photos` applied; RLS read-policy for booking parties; 0 new advisor warnings.
    - `backend/app/api/booking_events.py` (POST + GET /bookings/{id}/events, push on every event)
    - `backend/app/api/booking_photos.py` (POST + GET /bookings/{id}/photos, before/after)
    - `backend/app/main.py` — both routers registered under /bookings prefix
    - `mobile/src/components/LiveStatusTimeline.js`, `LiveStatusActions.js`, `BookingPhotos.js`
    - `mobile/src/screens/business/JobManagementScreen.js`, `mobile/src/screens/client/BookingDetailsScreen.js` — wired
  GATES:
    - Backend AST + uvicorn boot OK; all routes registered
    - Mobile babel-parse OK (7 files)
    - Supabase advisors: 0 new
  NEEDS REVIEW:
    - On-device verification pending Render redeploy (HUMAN-TODO #1)
STATUS: RESOLVED
---

---
ID: 20260624-0003
FROM: orchestrator
TO: broadcast
TYPE: DONE
REF: PLAN.md::P6
PRIORITY: NORMAL
TIMESTAMP: 2026-06-24T00:45:00Z
SUBJECT: Smoke test script ready (full beta flow)
BODY:
  SHIPPED:
    - `backend/scripts/smoke_e2e.py` — health → signup/login → business → post → quote → accept → confirm-date → arrived → started → before-photo → completed → after-photo → release payment → review → verify events
    - Exit codes: 0 ok / 2 step-failed / 3 confirm-email-on without seed creds / 4 timeline-empty
  NEEDS REVIEW:
    - HUMAN-TODO #2: env vars for confirmed seed creds so the script can run on Render
STATUS: RESOLVED
---

---
ID: 20260624-0004
FROM: orchestrator
TO: broadcast
TYPE: DONE
REF: PLAN.md::P2
PRIORITY: HIGH
TIMESTAMP: 2026-06-24T03:30:00Z
SUBJECT: P2 Stripe sandbox — backend scaffold + mobile Pay button shipped
BODY:
  SHIPPED:
    - backend/app/services/stripe_service.py (lazy stripe import, create_checkout_session, verify_webhook)
    - backend/app/api/payments_stripe.py (POST /checkout/{id} + POST /webhook with signature verification)
    - backend/app/config.py (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL)
    - backend/requirements.txt (+stripe>=10.0,<12)
    - backend/app/main.py (router registered under /payments/stripe)
    - mobile/src/screens/client/BookingDetailsScreen.js (Pay with card button → Linking.openURL on Checkout URL)
  GATES:
    - FastAPI boot: 63 routes; /payments/stripe/checkout/{booking_id} + /payments/stripe/webhook present; app boots clean without STRIPE_SECRET_KEY (503 only at request time)
    - Mobile babel-parse: clean
  NEEDS REVIEW:
    - HUMAN-TODO #3: Stripe test account + STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in Render + webhook endpoint in Stripe dashboard
  NEXT: push → deploy → set Stripe envs → on-device verify with test card 4242 4242 4242 4242
STATUS: RESOLVED
---

---
ID: 20260617-0003
FROM: design-agent
TO: mobile-agent
TYPE: REQUEST
REF: 20260617-0001
PRIORITY: NORMAL
TIMESTAMP: 2026-06-17T12:01:00Z
SUBJECT: Implement beta-tester invite card (pending orchestrator approval)
RESOLUTION (2026-07-17, orchestrator): Stale — never dispatched. Spec still lives at
  AGENTS/claude/deliverables/beta-invite-card-spec.md (bus INPUTS pointed at the dead
  Windows path). No invite-card screen exists in mobile/src. Superseded by the D4 tester
  kit (Roadmap/dominoes/D4-tester-brief.md) for the beta; the in-app invite card moves
  to the never-started backlog — re-open as a fresh REQUEST if D4 feedback wants it.
STATUS: RESOLVED
---

---
ID: 20260623-0001
FROM: orchestrator-inline (Claude Opus 4.7, recovery from crashed prior session)
TO: orchestrator
TYPE: DONE
REF: BRIEF-reorg-mobile-web (Phase 3 only)
TIMESTAMP: 2026-06-23T16:00:00Z
SUBJECT: Mobile screens reorg complete (Phase 3) — Phase 5 web verified no-op
RESOLUTION (2026-07-17, orchestrator ACK): Reorg long since committed (938799e) and
  stable — 9 buckets, flow graph 0 orphans at HEAD. Open NEXT_AGENT asks closed:
  (1) SettingsScreen + TermsOfServiceScreen stayed in shared/ — no complaints in 3 weeks,
  accepted as final; (2) commit strategy resolved (single commit, shipped); (3) Phase 5
  web bucketing deferred indefinitely per Kira (PLAN.md Parked).
STATUS: RESOLVED
---
