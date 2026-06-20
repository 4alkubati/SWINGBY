# Autonomous 100-Task Background Run

You are operating in bypass-permissions mode while the founder is in another tab wiring credentials into n8n. Your job is to grind through 100 polish/expansion tasks safely without touching anything that could break the live workflow setup.

**Context budget: stop gracefully at ~70% context use.** When you sense you're approaching the limit, finish the current task → run any pending commits → push → print a clean summary → exit. Do NOT push partial work.

---

## CRITICAL — hard rules. Read twice.

1. **NEVER touch `.env`, `.env.local`, or any file matching `.env*`** (the live keys).
2. **NEVER touch `.claude/secrets/*`** (credential files).
3. **NEVER call any `mcp__n8n__*` tool.** Three workflows are being actively wired by the founder — do not modify them.
4. **NEVER call `mcp__0081b859-*__execute_sql` or `apply_migration` or any other Supabase write tool.** Reads are fine. No writes, no schema changes.
5. **NEVER modify these "live" backend files** — admin login + auth depend on them:
   - `backend/app/api/auth.py`
   - `backend/app/api/admin.py`
   - `backend/app/deps.py`
   - `backend/app/main.py`
   - `backend/app/supabase_client.py`
   - `backend/app/limiter.py`
6. **NEVER stop, restart, or kill any background process** — the founder may have `npm run dev` and the FastAPI server running.
7. **NEVER write secrets, tokens, or passwords to any file or commit.** If you find one in code, leave a `// SECURITY:` comment but don't print or commit it.
8. **NEVER use destructive git operations** (`reset --hard`, `push --force`, `clean -f`, branch deletes).
9. **Match existing voice** (per `marketing/09-brand-guidelines.md`): direct, warm, plain. No "unlock," "leverage," "ecosystem."
10. **Commit per workstream**, push after each. If a workstream produces zero changes, skip the commit. Five+ small commits is fine.

---

## Safe sandboxes (yes-touch list)

- `web/launch/src/**` (except live route configs — read existing routing tree first)
- `web/pre-launch/src/**` (lower priority, but allowed)
- `marketing/**`
- `privacy-and-security/**`
- `mobile/src/**` (mobile work is lowest priority — only if other workstreams done)
- `docs/**`
- `backend/app/api/*.py` — only NEW files (e.g. `business_analytics.py`), never modify existing
- Test files anywhere
- Any new file you create

---

## 100 tasks — pick any order

You may execute non-sequentially. Group by workstream to keep commits clean.

---

### Workstream A — web/launch polish (10 tasks)

- [ ] A1 — Run `cd web/launch && npm audit` → record findings → fix any high/critical via `npm audit fix` (NOT `--force`).
- [ ] A2 — Run `cd web/launch && npm run lint` → fix all ESLint errors. Warnings OK if intentional.
- [ ] A3 — Accessibility sweep: every interactive element has accessible name (button text, `aria-label`, or icon + `aria-label`). Read 5 pages from `web/launch/src/pages/` and fix.
- [ ] A4 — Add `<ErrorBoundary>` wrapper to every protected route in `App.jsx` if not already there.
- [ ] A5 — Add `<Skeleton>` loading state to BusinessAnalytics, BusinessEarnings, Bookings — replace generic spinners with content-shaped skeletons.
- [ ] A6 — Add empty states (illustration + 1-line message + CTA) to Favorites, SavedSearches, BlogIndex, HelpCenter, Messages.
- [ ] A7 — 404 page polish: add 4 link cards to popular destinations (Home, Help, Pricing, Login). Make it feel intentional, not broken.
- [ ] A8 — Maintenance page polish: better illustration, ETA placeholder, status link.
- [ ] A9 — SEO sweep: every public page has `<SEO>` component with `title`, `description`, `og:image`. Audit which lack it and add.
- [ ] A10 — Default OG image: write a simple SVG-to-PNG generator script (or use a static 1200x630 PNG you create as SVG) → place at `public/og-default.png` and reference from `<SEO>` defaults.

### Workstream B — web/launch features (10 tasks)

- [ ] B1 — Add `<Toaster>` wrapper from `react-hot-toast` to App root if not present; replace any `alert()` calls with toasts.
- [ ] B2 — Add "Copy link" button next to API keys → uses Clipboard API + toast confirm.
- [ ] B3 — Add search box to HelpCenter that filters articles client-side (Fuse.js or simple `includes`).
- [ ] B4 — Add breadcrumbs to all sub-pages (Blog → Post, Help → Article, Category → Detail).
- [ ] B5 — Add "Dark mode toggle" using `prefers-color-scheme` + manual override stored in localStorage. Tokens in `theme/tokens.css` should already support both.
- [ ] B6 — Add "Last updated" auto-rendered timestamp to BlogPost + HelpArticle from frontmatter or date field.
- [ ] B7 — Add reading-time estimate to BlogPost ("5 min read").
- [ ] B8 — Add share buttons (X, LinkedIn, Copy link) to BlogPost.
- [ ] B9 — Add anchor-link scroll behavior with offset for sticky header.
- [ ] B10 — Add `print:` CSS for BookingDetail so it prints as a clean receipt.

### Workstream C — marketing content expansion (10 tasks)

- [ ] C1 — Fill `marketing/MARKETING-PLAN.md:260` TODO with a placeholder team section: "Founder: Amr. Currently solo. Advisors: TBD. Hires planned: marketing lead Q4." Mark with `<!-- HUMAN: replace with real team when ready -->`.
- [ ] C2 — Fill `marketing/MARKETING-PLAN.md:263` TODO with a default "not currently raising" paragraph + a placeholder funding ask table. Mark with HUMAN comment.
- [ ] C3 — Create `marketing/content-library/instagram-week-1.md` with 7 ready-to-post IG captions (one per day). Each: hook, body, CTA, hashtags. Use voice from `marketing/09-brand-guidelines.md`.
- [ ] C4 — Create `marketing/content-library/instagram-week-2.md` (same shape, 7 more captions).
- [ ] C5 — Create `marketing/content-library/instagram-week-3.md` (7 more).
- [ ] C6 — Create `marketing/content-library/instagram-week-4.md` (7 more). That's a full month of IG queued.
- [ ] C7 — Create `marketing/content-library/facebook-week-1-4.md` with 28 FB Page-tailored captions (longer, more conversational than IG).
- [ ] C8 — Create `marketing/content-library/founder-linkedin-30.md` with 30 LinkedIn posts (founder voice, build-in-public).
- [ ] C9 — Create `marketing/content-library/customer-story-template.md` with a fill-in-the-blank story format + 3 example stories.
- [ ] C10 — Create `marketing/content-library/README.md` indexing everything in the folder, with usage instructions ("paste into Notion content queue, edit as needed").

### Workstream D — hyperlocal SEO pages (10 tasks)

- [ ] D1 — Read `web/launch/src/pages/CategoryPage.jsx` + `CalgaryPage.jsx` to understand the template structure.
- [ ] D2 — Create `web/launch/src/data/neighbourhoods.js` listing 10 Calgary neighbourhoods (Beltline, Mission, Kensington, Inglewood, Ramsay, Bridgeland, Hillhurst, Bankview, Killarney, Erlton) with: name, slug, postal-code prefix, 1-sentence description.
- [ ] D3 — Create `web/launch/src/data/seo-content.js` containing per-category × per-neighbourhood 200-word blurbs. Start with 5 entries (Beltline × house cleaning, Mission × handyman, Kensington × dog walking, Inglewood × personal training, Bridgeland × lawn care). More later.
- [ ] D4 — Create `LocationCategoryPage.jsx` component that reads neighbourhood + category from URL params and renders: H1, 200-word intro from `seo-content.js`, 5 FAQ items, CTA.
- [ ] D5 — Wire route `/calgary/:neighbourhood/:category` to `LocationCategoryPage` in `App.jsx`. Render 404 if combo not in `seo-content.js`.
- [ ] D6 — Add JSON-LD `Service` schema to `LocationCategoryPage`.
- [ ] D7 — Add 5 more entries to `seo-content.js` (Beltline × handyman, Mission × dog walking, Kensington × house cleaning, Inglewood × dog walking, Bridgeland × handyman).
- [ ] D8 — Update `web/launch/public/sitemap.xml` to include the 10 location-category URLs.
- [ ] D9 — Create `marketing/campaigns/hyperlocal-seo-50-pages.md` documenting the SEO build plan: 5 categories × 10 neighbourhoods = 50 pages, target keywords per combo, content ramp cadence.
- [ ] D10 — Add 10 more `seo-content.js` entries to reach 20 total (continue Mission × house cleaning, Kensington × handyman, etc.).

### Workstream E — email templates + drips (10 tasks)

- [ ] E1 — Create `web/launch/docs/email_templates/welcome_client.html` — plain HTML, no JS, table-based layout, tested in dark mode. Brand colors from `theme/tokens.css`.
- [ ] E2 — Create `welcome_business.html` — similar shape, business onboarding focused.
- [ ] E3 — Create `booking_confirmed.html` — client-side notification.
- [ ] E4 — Create `booking_confirmed_business.html` — business-side notification.
- [ ] E5 — Create `payment_released.html` — escrow release notification.
- [ ] E6 — Create `review_request.html` — sent 24h after job completion.
- [ ] E7 — Create `weekly_business_digest.html` — earnings + bookings summary.
- [ ] E8 — Create `marketing/templates/drip-new-client.md` — 5-email sequence over 30 days. Subject + body per email.
- [ ] E9 — Create `marketing/templates/drip-new-business.md` — 5-email onboarding sequence over 14 days.
- [ ] E10 — Create `marketing/templates/drip-reactivation.md` — 3-email sequence for users inactive 60+ days.

### Workstream F — mobile app polish (10 tasks — lowest priority)

- [ ] F1 — Run mobile lint: `cd mobile && npx eslint src --max-warnings 0` → fix errors. (Skip if no eslint config — create one.)
- [ ] F2 — Audit `mobile/src/screens/` for unhandled promise rejections. Wrap async handlers with try/catch.
- [ ] F3 — Add loading spinners to Login, Signup, PostJob, PaymentMethod screens.
- [ ] F4 — Add empty states to MessagesScreen, NotificationsScreen, MyJobsScreen.
- [ ] F5 — Add pull-to-refresh to MyJobsScreen, MessagesScreen, NotificationsScreen.
- [ ] F6 — Add `accessibilityLabel` to icon-only buttons across screens.
- [ ] F7 — Audit error states: every API call should show a user-facing error toast, not a console.error.
- [ ] F8 — Add offline banner reuse — confirm `OfflineBanner.js` mounts at root.
- [ ] F9 — Add app version footer to SettingsScreen reading from `expo-application`.
- [ ] F10 — Add "Force log out" button to SettingsScreen that clears AsyncStorage + redirects.

### Workstream G — testing (10 tasks)

- [ ] G1 — Create `web/launch/src/__tests__/Home.test.jsx` smoke test (renders without crashing).
- [ ] G2 — Create test for Login form validation (zod schema rejects bad email, weak password).
- [ ] G3 — Create test for Signup tab switching (Client/Business).
- [ ] G4 — Create test for ApiKeys page (creates key, shows once, hides on second render).
- [ ] G5 — Create test for BusinessAnalytics empty state.
- [ ] G6 — Create test for CSV export (downloads correct columns).
- [ ] G7 — Create test for XLSX export (file is valid xlsx).
- [ ] G8 — Create test for ProtectedRoute (redirects unauth'd users to /login).
- [ ] G9 — Create test for RoleRoute (business pages reject client users).
- [ ] G10 — Wire `npm test` script in `web/launch/package.json` to run vitest.

### Workstream H — docs + onboarding (10 tasks)

- [ ] H1 — Update `CLAUDE.md` session log with the n8n setup work + current state.
- [ ] H2 — Create `docs/RUNNING_LOCALLY.md` — step-by-step for someone cloning the repo to get all 4 surfaces running (backend, web/pre-launch, web/launch, web/admin, mobile).
- [ ] H3 — Create `docs/DEPLOYING.md` — Render backend deploy, Cloudflare Pages frontend deploy, environment variable checklist.
- [ ] H4 — Create `docs/ONBOARDING_TEAMMATE.md` — how to grant a new teammate access to Supabase, n8n, GitHub, with the minimum-privilege checklist.
- [ ] H5 — Create `docs/INCIDENT_PLAYBOOK.md` — adapted from `privacy-and-security/incident-response.md` but operator-focused (specific commands to run).
- [ ] H6 — Update `web/launch/README.md` with full project setup, env vars, scripts.
- [ ] H7 — Update `web/admin/README.md` with same.
- [ ] H8 — Update `backend/README.md` with same.
- [ ] H9 — Update root `README.md` with a clean "What is SwingBy + how to run + how to deploy" overview.
- [ ] H10 — Create `docs/ARCHITECTURE.md` — Mermaid diagram of all surfaces + how they talk + RLS overview.

### Workstream I — backend roadmap (10 tasks — OPT-IN ONLY)

Backend changes are higher-risk. Only do these if other workstreams are done AND backend tests pass cleanly. Read existing endpoints first.

- [ ] I1 — Read `backend/app/api/businesses.py` to understand existing patterns.
- [ ] I2 — Create NEW file `backend/app/api/business_analytics.py` with `GET /businesses/me/analytics?from=&to=` returning aggregated counts. Use Supabase client. DO NOT modify existing files.
- [ ] I3 — Register the new router in `backend/app/main.py` with one added line (`app.include_router(...)`).
- [ ] I4 — Create NEW file `backend/app/api/business_earnings.py` with `GET /businesses/me/earnings`.
- [ ] I5 — Register earnings router.
- [ ] I6 — Create NEW file `backend/app/api/business_clients.py` with `GET /businesses/me/clients`.
- [ ] I7 — Register clients router.
- [ ] I8 — Create `docs/wave-6-api-keys.sql` migration: `CREATE TABLE business_api_keys (id uuid PK, business_id uuid FK, key_hash text, name text, created_at timestamptz, revoked_at timestamptz)` + RLS policies. **DO NOT APPLY** — just write the file. Mark with `> TODO (HUMAN): apply this migration in Supabase before enabling api-keys backend`.
- [ ] I9 — Create `backend/app/api/api_keys.py` skeleton (file only — leave routes commented out with `# TODO: implement after migration applied`).
- [ ] I10 — Create `docs/wave-7-webhooks.sql` migration (table + RLS) and `backend/app/api/webhooks.py` skeleton.

### Workstream J — security + performance audit (10 tasks)

- [ ] J1 — Run `cd web/launch && npm run build` → check bundle size. If main chunk >300KB gzipped, identify culprit via `vite-bundle-visualizer` or manual inspection.
- [ ] J2 — Audit `web/launch/public/_headers` against `securityheaders.com` recommendations. Add missing headers.
- [ ] J3 — Verify CSP in `_headers` allows Supabase + Sentry + Cloudflare WA domains.
- [ ] J4 — Add `connect-src` allowlist for all external API calls the site makes.
- [ ] J5 — Run a content audit for any hardcoded URLs that should be env vars.
- [ ] J6 — Grep `web/launch/src` for `console.log` — wrap in dev-only `if (import.meta.env.DEV)` checks.
- [ ] J7 — Grep `mobile/src` for `console.log` — same treatment.
- [ ] J8 — Audit `privacy-and-security/security-checklist.md` — check off any items now done; add new findings.
- [ ] J9 — Create `docs/SECURITY-AUDIT-2026-06.md` — record current security posture as a snapshot.
- [ ] J10 — Verify `.gitignore` covers all credential paths: `.env*`, `.claude/secrets/*`, `*.pem`, `*.key`, `SEED ACCOUNT*`.

---

## Workflow

For each workstream:

1. Read the relevant existing files first (don't guess at conventions).
2. Make the changes for all tasks in that workstream.
3. Run any verification (lint, build, tests) that fits.
4. `git add` only the files you intended to change.
5. Commit with a descriptive message:
   ```
   <type>(<scope>): workstream <letter> — <short description>
   ```
6. `git push origin main`.
7. Move to next workstream.

---

## Context budget

Self-monitor. Rough proxy: count tool calls and file reads. If you've done 200+ significant operations or ~70% feels close, do this:

1. Finish the current task only (don't start a new one mid-thought).
2. Commit + push whatever's done.
3. Print the SUMMARY block (below).
4. Exit.

Do NOT push partial files or partial commits.

---

## SUMMARY block to print at end

```
AUTONOMOUS RUN SUMMARY
======================
Started: <ISO timestamp>
Stopped: <ISO timestamp>
Reason for stop: <completed all 100 | context budget approached | blocker>

Workstreams completed:
  A — web polish:           <N/10>
  B — web features:         <N/10>
  C — marketing content:    <N/10>
  D — SEO pages:            <N/10>
  E — email templates:      <N/10>
  F — mobile polish:        <N/10>
  G — testing:              <N/10>
  H — docs:                 <N/10>
  I — backend roadmap:      <N/10>
  J — security audit:       <N/10>
  Total: <N/100>

Files created: <N>
Files modified: <N>
Lines added (approx): <N>
Commits pushed: <N>

TODOs left for human:
  <list each with file:line — only the ones added during this run>

Next steps for human:
  - <one line>
  - <one line>
```

---

## Go

Read `CLAUDE.md` + `marketing/09-brand-guidelines.md` first (5 min). Then start with Workstream A (lowest risk, quickest wins). Burn through as many tasks as you can within the budget. Be specific in commits. Push after each workstream.

If you hit a real blocker on a specific task, leave a `> TODO (HUMAN):` block and move on. Never stop the run waiting for the user.
