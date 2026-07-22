---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build]
---
# SwingBy — Session Log

Historical record of significant work sessions. Current state lives in `CLAUDE.md`.

| Date | What was done |
|---|---|
| 2026-05-13 | Built entire backend — 9 API modules, all endpoints, auth dependency |
| 2026-05-14 | Added auth/me, geo-browse, input validation, supabase hardening, orphan cleanup |
| 2026-05-14 | Applied all RLS policies to Supabase via MCP, expiry cron live, 0 security warnings |
| 2026-05-16 | Starting web/ — pre-launch website (Version 1) |
| 2026-06-07–08 | Built web/launch/ — full launch site (Workstreams A–E, 5 commits pushed) |
| 2026-06-10 | Autonomous 100-task polish run: ESLint fix (eslint-plugin-react), 404/maintenance polish, OG image SVG, skeleton loaders, share buttons, print CSS, anchor scroll, hyperlocal SEO pages (17 live), 7 email templates + 3 drip sequences, 4-week IG content, 28 FB posts, 30 founder LinkedIn posts, customer story templates; n8n social automation workflows wired by founder in parallel |
| 2026-06-15 | Full cross-platform audit (backend+mobile+web+design+AGENTS orchestrator directory). Fixed: photo upload in PostJobScreen (expo-image-picker + /uploads/image backend + Supabase Storage bucket job-photos), address field now sent to backend (image_urls + address columns added to service_posts), ForgotPasswordScreen created + POST /auth/forgot-password endpoint + wired in AuthNavigator, LoginScreen Forgot password? link activated, Supabase Storage RLS policies applied, comprehensive ORCHESTRATOR_ISSUES.md created (36 issues tracked across CRITICAL/HIGH/MEDIUM/LOW/DESIGN). |
| 2026-06-15 | Backend Workstream I: GET /businesses/me/analytics — earnings, bookings, categories, reviews. Mobile Workstream J: wired analytics screen, add-employee form, email confirmation state. |
| 2026-06-16–17 | Workstreams A–F: empty-nearby graceful handling, floating label inputs, Places autocomplete + native time picker, seed one business per category, web/admin platform analytics dashboard, web/launch business dashboard analytics. |
| 2026-06-18 | Workstream G: i18n scaffold EN/FR/AR for web + mobile. Workstream H docs: multi-stop routing, business bidding, i18n rollout roadmap. |
| 2026-06-20 | AGENTS orchestrator kit + Roadmap added. Resend/Supabase email wired. Mobile + backend updates. |
| 2026-06-21 | Domain fixed to swingbyy.com across code/docs/marketing. Auth honesty + cascade migration. Workspace map + cleanup. |
| 2026-06-22 | AGENTS+memory sync: briefs, memory checkpoints, workspace map, docs/legal split. |
| 2026-06-23 | Mobile screens reorg: bucketed all 41 screens into mobile/src/screens/{auth,onboarding,admin,business,client,flows,messages,profile,shared}. 40 git mv ops, regex-patched `../` → `../../` in every moved file, updated 53 import refs in App.js + 3 navigators. Web/launch unaffected. |
| 2026-06-23 | Backend: live job status (booking_events + booking_photos tables) + Stripe sandbox + e2e smoke. Mobile: live status UI + pay-with-card + screens bucket reorg. |
| 2026-06-24 | AGENTS+docs: orchestrator kit, memory checkpoints, gitignore tightening. |

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]

**Related:** [[CLAUDE]]
<!-- graph-wire:end -->
