# MESSAGE_BUS — Inter-Agent Communication

> Append-only. Newest at the bottom. Orchestrator reads the last 20 every cycle and routes them.
> Only the Orchestrator routes. Subagents only see what's routed TO them.

## Message schema

```
---
ID: <ULID-or-timestamp>
FROM: <agent-name>
TO: <agent-name | orchestrator | broadcast>
TYPE: <REQUEST | RESPONSE | BLOCKED | ESCALATE | BROADCAST | DONE>
REF: <related ID / task ID / empty>
PRIORITY: <CRITICAL | HIGH | NORMAL | LOW>
TIMESTAMP: <ISO-8601>
SUBJECT: <one line ≤80 chars>
BODY:
  GOAL:
  INPUTS:
  CONSTRAINTS:
  ACCEPTANCE:
STATUS: <OPEN | ACKED | RESOLVED>
---
```

## Bus

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
ID: 20260617-0003
FROM: design-agent
TO: mobile-agent
TYPE: REQUEST
REF: 20260617-0001
PRIORITY: NORMAL
TIMESTAMP: 2026-06-17T12:01:00Z
SUBJECT: Implement beta-tester invite card (pending orchestrator approval)
BODY:
  GOAL: Implement the beta invite card as a React Native / Expo screen using the approved spec.
  INPUTS:
    - C:\Users\amrba\OneDrive\Desktop\AMR\CODE\Swingby\AGENTS\claude\deliverables\beta-invite-card-spec.md
  CONSTRAINTS:
    - Do not implement until orchestrator marks 20260617-0002 RESOLVED
    - Use exact design tokens from spec — no deviations
    - WCAG AA touch targets enforced
    - No backend calls from this screen (invite is static/deep-link based)
  ACCEPTANCE:
    - Screen renders on iPhone SE (375px) and Pro Max (430px)
    - All states implemented per spec
    - Screen reader labels wired
  MCPs ALLOWED: WebSearch, WebFetch (React Native docs only)
  DEADLINE: After orchestrator approval
STATUS: OPEN
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
