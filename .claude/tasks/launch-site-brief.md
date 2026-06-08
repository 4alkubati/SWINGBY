# Autonomous Task Brief — SwingBy Launch Site, Business Dashboard, Security, Admin Fix

You are operating autonomously on the SwingBy project in bypass-permissions mode. The user has approved long uninterrupted execution. This brief covers five workstreams totaling ~110 tasks. Work end-to-end. Do not stop to ask questions unless something is truly blocking (in which case, leave a `> TODO (HUMAN):` block and continue).

---

## Mission in one sentence

Build a production-ready, secure, hostable **launch site** at `web/launch/`, with a real business-side analytics dashboard, spending APIs, Excel/CSV exports, dual sign-in (client + business), DDoS + brute-force protection, and fix the admin login that currently doesn't work.

---

## Context — what exists today

Read these files before starting:

1. `CLAUDE.md` (project root) — master context, schema, endpoints.
2. `marketing/01-monetization-strategy.md` through `marketing/10-partnerships.md` — voice, pricing, positioning. Reuse this content where the launch site needs marketing copy.
3. `marketing/09-brand-guidelines.md` — voice, colors, typography rules.
4. `web/pre-launch/` — existing marketing site (~60 pages). **Source material**: you may copy and adapt page structure, components, and styles from here. Do NOT modify `web/pre-launch/` itself.
5. `web/admin/` — internal admin app, separate React Vite project. Read `src/services/auth.js`, `src/pages/LoginPage.jsx`, `src/components/ProtectedRoute.jsx` to understand current admin auth flow.
6. `web/launch/` — currently empty except `.gitkeep`. This is your build target.
7. `backend/app/api/admin.py`, `backend/app/api/auth.py`, `backend/app/deps.py` — backend auth + admin role checks.
8. `backend/app/main.py` — all registered routers.
9. `docs/rls_policies.sql` — RLS rules. The site must respect these.

**Tech stack to use for `web/launch/`:**
- Vite + React 18 (match pre-launch / admin conventions)
- React Router DOM 6
- Plain CSS Modules (match existing style — no Tailwind unless pre-launch already uses it)
- Axios for backend calls (match pre-launch)
- `@phosphor-icons/react` for icons (match admin) — or Lucide if pre-launch uses it; pick whichever is already in pre-launch
- Recharts or Chart.js for analytics charts
- TanStack Table (`@tanstack/react-table`) for data tables
- `xlsx` (SheetJS) for Excel export, native CSV for CSV
- React Hook Form + Zod for forms with validation
- TanStack Query (`@tanstack/react-query`) for server state
- Sentry (already wired in pre-launch — port it)
- PostHog or Plausible for product analytics (port if pre-launch has it)

---

## Constraints — non-negotiable

1. **No secrets in any file.** Never commit `.env`, Supabase service key, Stripe keys, JWT secrets. Use Vite `import.meta.env.VITE_*` for client-side config — only put values that are safe in a browser bundle there (anon Supabase key is fine; service role key is NOT).
2. **Do not modify `web/pre-launch/`.** Copy from it, never write to it. Same rule for `web/admin/` and `backend/` (with the explicit exceptions listed in Workstream E — admin fix).
3. **Match existing voice.** Use the voice rules in `marketing/09-brand-guidelines.md`. No "revolutionary," "unlock," "leverage."
4. **Real implementations, not stubs.** Every page must render and route. Every form must validate. Every API call must handle loading/error/empty states. No `console.log("TODO: implement")` in shipped code.
5. **Accessibility:** WCAG 2.1 AA. Real semantic HTML, real ARIA where needed, keyboard navigation, focus rings, color contrast verified.
6. **Mobile responsive.** Every page works at 360px, 768px, 1024px, 1440px. Test by setting viewport in build process or with Playwright if you add it.
7. **No npm install of huge useless deps.** Add only what's actually used. Keep `package.json` lean.
8. **Lint clean.** Run `npm run lint` (add ESLint config if missing) and resolve real issues.
9. **One commit per workstream.** Five commits total, plus one final "wire everything" commit if needed. Push after each commit so a failure mid-run still leaves a recoverable state.
10. **Don't sleep waiting for things.** If a build takes a while, just wait — don't poll with sleep loops.

---

## Workstream A — Scaffold the launch site (`web/launch/`)

### A1. Initialize the project
- [ ] A1.1 — `cd web/launch && npm create vite@latest . -- --template react` (non-interactive: pass answers via env if needed; if `npm create` is interactive, manually scaffold by writing `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`).
- [ ] A1.2 — Install runtime deps: `react-router-dom @tanstack/react-query @tanstack/react-table axios react-hook-form zod @hookform/resolvers recharts xlsx file-saver date-fns clsx`
- [ ] A1.3 — Install dev deps: `eslint @vitejs/plugin-react vite`
- [ ] A1.4 — Add icon library that matches `web/pre-launch/` convention (read its package.json — likely lucide-react or @phosphor-icons/react).
- [ ] A1.5 — Add Sentry: `@sentry/react @sentry/vite-plugin`
- [ ] A1.6 — Add analytics: same as pre-launch (PostHog if it has it, Plausible otherwise).
- [ ] A1.7 — Create `.env.example` with `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY` (or `VITE_PLAUSIBLE_DOMAIN`). Do NOT create `.env`.
- [ ] A1.8 — Configure `vite.config.js` with React plugin, Sentry plugin (sourcemaps), and proper build output to `dist/`.
- [ ] A1.9 — Set `package.json` scripts: `dev`, `build`, `preview`, `lint`, `test`.
- [ ] A1.10 — Add `README.md` documenting: how to run dev, how to build, how to preview, env vars required, deployment notes.

### A2. Project skeleton
- [ ] A2.1 — `src/main.jsx` boots React, QueryClient provider, Router, Sentry, analytics.
- [ ] A2.2 — `src/App.jsx` defines top-level routes: marketing routes (public), auth routes, client routes (protected), business routes (protected), shared routes (404, 500, maintenance).
- [ ] A2.3 — `src/theme/` — copy `tokens.css`, `typography.css`, `reset.css` from pre-launch as starting point. Improve if needed.
- [ ] A2.4 — `src/lib/` — `api.js` (axios instance with interceptor for auth), `supabase.js` (browser client), `auth.js` (login/logout/getSession), `analytics.js`, `sentry.js`.
- [ ] A2.5 — `src/hooks/` — `useAuth`, `useUser`, `useDebounce`, `useMediaQuery`, `useLocalStorage`.
- [ ] A2.6 — `src/components/` (reusable): Button, Input, Select, Textarea, Checkbox, Switch, Modal, Drawer, Tabs, Accordion, Tooltip, Badge, Avatar, Card, Skeleton, Spinner, Alert, EmptyState, ErrorBoundary, PageHeader, Breadcrumbs, Pagination, DataTable, Chart wrappers (LineChart, BarChart, PieChart, AreaChart), StatCard, Header (marketing), DashboardLayout (app), Sidebar, MobileNav, Footer, SEO. Adapt from `web/pre-launch/` where possible.

### A3. Routing tree

| Route | Component | Protected | Notes |
|---|---|---|---|
| `/` | Home | public | Marketing homepage |
| `/how-it-works` | HowItWorks | public | |
| `/for-clients` | ForClients | public | |
| `/for-businesses` | ForBusinesses | public | |
| `/pricing` | Pricing | public | Mirrors marketing/02-pricing.md |
| `/safety` | Safety | public | |
| `/categories` | CategoriesIndex | public | SEO |
| `/categories/:slug` | CategoryPage | public | SEO |
| `/calgary` | CalgaryPage | public | SEO landing |
| `/calgary/:neighbourhood/:category` | LocationCategoryPage | public | SEO long-tail |
| `/about` | About | public | |
| `/blog` | BlogIndex | public | |
| `/blog/:slug` | BlogPost | public | |
| `/help` | HelpCenter | public | |
| `/help/:slug` | HelpArticle | public | |
| `/careers` | Careers | public | |
| `/press` | Press | public | |
| `/contact` | Contact | public | |
| `/privacy` | PrivacyPage | public | Pull from privacy-and-security/privacy-policy.md (if it exists; else placeholder) |
| `/terms` | TermsPage | public | |
| `/cookies` | CookiesPage | public | |
| `/accessibility` | AccessibilityPage | public | |
| `/login` | Login | public | Tabbed: Client / Business |
| `/signup` | Signup | public | Tabbed: Client / Business |
| `/forgot-password` | ForgotPassword | public | |
| `/reset-password` | ResetPassword | public | |
| `/auth/callback` | AuthCallback | public | OAuth + magic-link return |
| `/verify-email` | VerifyEmail | public | |
| `/app` | Redirect to /app/dashboard based on role | protected | |
| `/app/dashboard` | ClientDashboard or BizDashboard | protected | Router decides by role |
| `/app/bookings` | Bookings | protected | |
| `/app/bookings/:id` | BookingDetail | protected | |
| `/app/messages` | Messages | protected | |
| `/app/messages/:bookingId` | MessageThread | protected | |
| `/app/profile` | Profile | protected | |
| `/app/settings/account` | AccountSettings | protected | |
| `/app/settings/notifications` | NotificationSettings | protected | |
| `/app/settings/privacy` | PrivacySettings | protected | |
| `/app/settings/payment` | PaymentMethods | protected | |
| `/app/settings/api-keys` | ApiKeys (business only) | protected | |
| `/app/post` | PostJob (client only) | protected | |
| `/app/favorites` | Favorites (client only) | protected | |
| `/app/saved-searches` | SavedSearches (client only) | protected | |
| `/app/business/onboarding` | BusinessOnboarding (business only) | protected | |
| `/app/business/profile` | BusinessProfile (business only) | protected | |
| `/app/business/services` | BusinessServices (business only) | protected | |
| `/app/business/employees` | BusinessEmployees (business only) | protected | |
| `/app/business/analytics` | BusinessAnalytics (business only) | protected | Workstream C |
| `/app/business/earnings` | BusinessEarnings (business only) | protected | Workstream C |
| `/app/business/exports` | BusinessExports (business only) | protected | Workstream C |
| `/app/business/integrations` | BusinessIntegrations (business only) | protected | Workstream C |
| `/status` | StatusPage | public | |
| `/maintenance` | Maintenance | public | |
| `*` | NotFound | public | |

- [ ] A3.1 — Implement all routes above with real (not stub) page components.
- [ ] A3.2 — `ProtectedRoute` wrapper checks session, role, redirects appropriately.
- [ ] A3.3 — `RoleRoute` wrapper restricts business-only or client-only pages.

### A4. Marketing pages polish
- [ ] A4.1 — Home: hero (clear value prop matching `marketing/04-positioning-and-messaging.md`), three pillar sections (escrow, vetted, local), social proof strip, FAQ, CTA.
- [ ] A4.2 — Pricing page mirrors `marketing/02-pricing.md` exactly. Includes the founder-pricing banner.
- [ ] A4.3 — How It Works: split client side / business side, interactive step-through.
- [ ] A4.4 — For Businesses: dedicated landing page with onboarding CTA, value calculator (input your hours, see what SwingBy could earn you).
- [ ] A4.5 — For Clients: dedicated landing page with category showcase, map preview.
- [ ] A4.6 — Safety: trust mechanics, escrow visual, dispute flow, verification process.
- [ ] A4.7 — Calgary landing page: hero specific to Calgary, neighbourhoods listed with links.
- [ ] A4.8 — Help Center: searchable, category-tagged articles. Wire to `web/pre-launch/src/data/helpArticles.js` (copy data over).
- [ ] A4.9 — Blog: index + post pages. Wire to `web/pre-launch/src/data/blogPosts.js`.
- [ ] A4.10 — SEO: every public page has `<title>`, `<meta description>`, OG tags, JSON-LD where appropriate. Use the SEO component.

---

## Workstream B — Auth flows (client + business sign-in)

### B1. Unified sign-in/sign-up
- [ ] B1.1 — `/login` page with tabs: Client | Business. Same form fields (email, password) but routes to different post-login dashboards based on the role on the user record. No role selection at login — derive from DB.
- [ ] B1.2 — `/signup` page with tabs: Client | Business. Business tab collects additional fields (business_name, category, service_radius_km, lat/lng via Google Places autocomplete). Hits `POST /auth/signup` then `POST /businesses/` if business.
- [ ] B1.3 — Password rules enforced client-side (min 10 chars, mixed case, number) — match backend Pydantic rule. Show real-time strength meter.
- [ ] B1.4 — Email field accepts any valid email format. Do not block real TLDs.
- [ ] B1.5 — "Forgot password" + "Reset password" flows via Supabase Auth.
- [ ] B1.6 — Magic link option as alternative to password.
- [ ] B1.7 — Email verification page handles Supabase token in URL.
- [ ] B1.8 — OAuth: at minimum Google. Add Apple if iOS launch matters.
- [ ] B1.9 — Auth callback page handles Supabase redirect (parses session from URL fragment, stores it, redirects to `/app/dashboard`).
- [ ] B1.10 — Logout from anywhere clears session, clears query cache, redirects to `/`.

### B2. Session management
- [ ] B2.1 — Session restored on app boot from Supabase storage.
- [ ] B2.2 — Auto-refresh JWT on near-expiry (Supabase handles, but verify).
- [ ] B2.3 — Axios interceptor attaches `Bearer <token>` to every request to `VITE_API_URL`.
- [ ] B2.4 — 401 response → clear session, redirect to `/login` with `?next=<current path>`.
- [ ] B2.5 — Suspended user (`is_suspended: true`) → show a dedicated "Account suspended" screen with appeal contact, not the app.

---

## Workstream C — Business dashboard (analytics, spending, exports, API)

This is the big one — make it good enough that a business owner uses it daily.

### C1. Analytics dashboard (`/app/business/analytics`)
- [ ] C1.1 — Time-range selector: 7d, 30d, 90d, 1y, custom. URL-sync the range so it's bookmarkable.
- [ ] C1.2 — KPI strip: Bookings completed, Gross revenue, Net earnings (post 10% cut), Avg booking value, Active clients, Repeat-client rate, Avg rating, Response time. Each card shows current value + delta vs previous period.
- [ ] C1.3 — Revenue chart (line + area): daily/weekly/monthly bucketing.
- [ ] C1.4 — Bookings funnel (bar): Interests sent → Accepted → Completed → Reviewed.
- [ ] C1.5 — Category breakdown (donut/pie): which services drive what % of revenue.
- [ ] C1.6 — Client geography (heatmap or simple top-neighbourhoods bar): where bookings come from.
- [ ] C1.7 — Day-of-week / hour-of-day heatmap: when bookings happen.
- [ ] C1.8 — Top clients table: top 10 by revenue, with repeat-rate column.
- [ ] C1.9 — Employee performance (if business has employees): per-employee completed bookings, avg rating, hours.
- [ ] C1.10 — Cohort retention table: month-over-month client retention.

### C2. Earnings & spending (`/app/business/earnings`)
- [ ] C2.1 — Payout schedule explanation (50% on confirm, 40% on complete after 10% platform cut).
- [ ] C2.2 — Pending escrow balance, next payout date, last payout amount.
- [ ] C2.3 — Transaction ledger: per-booking row with gross, platform fee, Stripe fee, net.
- [ ] C2.4 — Year-to-date totals: gross revenue, fees paid to SwingBy, net earnings, refunds, disputes.
- [ ] C2.5 — Tax summary card: GST/HST collected if applicable, with note that this is informational and they should confirm with their accountant.
- [ ] C2.6 — Filter by date range, status (completed/disputed/refunded), category, employee.

### C3. Exports (`/app/business/exports`)
- [ ] C3.1 — CSV export for bookings (with all relevant fields).
- [ ] C3.2 — CSV export for payments/earnings.
- [ ] C3.3 — CSV export for clients.
- [ ] C3.4 — XLSX export via SheetJS (`xlsx`) — multi-sheet workbook: Bookings, Earnings, Clients, Summary.
- [ ] C3.5 — Date range selector + filter mirror the analytics page.
- [ ] C3.6 — Scheduled exports: "Email me a monthly XLSX on the 1st" — flag if backend doesn't support yet, leave UI placeholder with TODO.
- [ ] C3.7 — Tax-package export: a single PDF or XLSX bundle for accountants. Include monthly subtotals.

### C4. API access for businesses (`/app/business/integrations` + `/app/settings/api-keys`)
- [ ] C4.1 — API keys page: create / revoke / rotate. Show key once on creation. Hash + store backend (flag if backend route doesn't exist — leave UI but disable creation with a "coming soon" note and a `> TODO (HUMAN):` to wire backend).
- [ ] C4.2 — API documentation page: list endpoints a business can call (read bookings, read clients, read earnings). Generate from FastAPI's `/docs` OpenAPI spec link.
- [ ] C4.3 — Webhooks: configure URL + secret, choose events (booking.created, booking.completed, payment.released). Test webhook button.
- [ ] C4.4 — Integrations gallery: tiles for QuickBooks, Wave, FreshBooks, Google Sheets, Zapier, Make, n8n. For year-1 launch, each tile opens a help article on how to connect via the API or CSV. Real integrations are roadmap; mark with "Roadmap" badge where not built.
- [ ] C4.5 — Rate-limit display: show their current API rate limit and usage.

### C5. Backend additions (if missing — check before adding)
- [ ] C5.1 — Verify `GET /businesses/me/analytics?from=&to=` endpoint exists. If not, create it in `backend/app/api/businesses.py` returning the aggregates needed for C1. Use SQL aggregation on the Supabase backend, not in Python.
- [ ] C5.2 — Verify `GET /businesses/me/earnings?from=&to=` exists; add if not.
- [ ] C5.3 — Verify `GET /businesses/me/clients?from=&to=` exists; add if not.
- [ ] C5.4 — Add `POST /api-keys`, `GET /api-keys`, `DELETE /api-keys/{id}` endpoints with bcrypt-hashed keys and a `business_api_keys` table — if backend doesn't already have. If schema migration would be required, add the SQL migration to `docs/` as `wave-N-api-keys.sql` and flag with `> TODO (HUMAN): apply this migration in Supabase before enabling the feature in production`.
- [ ] C5.5 — Apply rate-limiting on the business analytics endpoints (60/min via existing `app.limiter`).

---

## Workstream D — Security hardening (DDoS + brute-force + general)

### D1. Brute-force protection
- [ ] D1.1 — Frontend: throttle login form submissions client-side (max 5 attempts per minute per email), show countdown.
- [ ] D1.2 — Backend: verify `slowapi` / `app.limiter` is applied to `POST /auth/login` and `POST /auth/signup`. Cap at 5/min per IP and 5/15min per email. Add if missing.
- [ ] D1.3 — Backend: lock account for 15 min after 10 consecutive failed logins for the same user. Track in `auth.users` metadata or a new `login_attempts` table. If schema change needed, write migration + flag for human.
- [ ] D1.4 — Backend: add Captcha (hCaptcha or Cloudflare Turnstile) after 3 failed attempts. Wire frontend to show challenge.
- [ ] D1.5 — Frontend: never reveal whether email or password was wrong on failed login — always "Invalid email or password."

### D2. DDoS protection
- [ ] D2.1 — Document Cloudflare front-of-domain setup in `web/launch/docs/security-deployment.md`: enable proxy (orange cloud), set security level to High during launch, enable Bot Fight Mode, set rate-limiting rules (100 req/min per IP to `/api/*`, 30/min to `/auth/*`).
- [ ] D2.2 — Backend: per-IP rate limit on all routes via `slowapi`. Verify in `backend/app/main.py` that the limiter is registered.
- [ ] D2.3 — Backend: per-user rate limit on expensive routes (analytics, exports). Cap at 30/min.
- [ ] D2.4 — Backend: request size limit (Starlette middleware) — reject bodies >2MB except file-upload routes which cap at 25MB.
- [ ] D2.5 — Frontend: CDN-cacheable headers on static assets (set in `public/_headers` matching the existing pre-launch pattern).
- [ ] D2.6 — `public/_headers` includes: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP. Strict CSP with nonces for inline scripts.
- [ ] D2.7 — Frontend: disable autocomplete on sensitive fields, set autocomplete="new-password" on signup password.

### D3. CSRF + XSS
- [ ] D3.1 — All forms use POST with JSON body, no traditional form submission. Verify no `dangerouslySetInnerHTML` in code. Sanitize any user-generated content rendered.
- [ ] D3.2 — All `<a href={userProvidedUrl}>` validated to be http/https only (no `javascript:`).
- [ ] D3.3 — Cookies marked Secure, HttpOnly, SameSite=Lax. (Supabase handles session, but verify if any custom cookies exist.)
- [ ] D3.4 — CORS on backend restricted to known origins (`web/launch` prod domain, `web/admin`, `web/pre-launch`, localhost during dev). Verify in `backend/app/main.py`.

### D4. Dependency + supply chain
- [ ] D4.1 — Run `npm audit` in `web/launch`. Fix high/critical advisories.
- [ ] D4.2 — Add `.npmrc` with `audit-level=moderate`.
- [ ] D4.3 — Pin React, React Router, Vite versions exactly in `package.json` (no `^` for these critical deps).
- [ ] D4.4 — Add a GitHub Actions workflow `.github/workflows/web-launch-ci.yml` running `npm ci`, `npm run lint`, `npm run build` on every push touching `web/launch/**`.

### D5. Secrets + ops
- [ ] D5.1 — Verify `web/launch/.env` is gitignored. (Already handled by global `.env` pattern.)
- [ ] D5.2 — Add a `web/launch/SECURITY.md` covering: vuln disclosure email (security@swingby.ca), in-scope assets, response SLA.
- [ ] D5.3 — Frontend Sentry: filter PII before sending (use `beforeSend` to strip email/phone from error events).
- [ ] D5.4 — Add a `<MaintenanceMode>` flag readable from env so the site can flip to maintenance without a redeploy.

### D6. Observability
- [ ] D6.1 — Wire Sentry: capture render errors via ErrorBoundary, network errors via axios interceptor.
- [ ] D6.2 — Add a `/status` page that pings `GET /health` on the backend and shows up/down + last-checked timestamp.
- [ ] D6.3 — Console logging: only in dev mode. Use a tiny `logger` wrapper that no-ops in prod.

---

## Workstream E — Admin login fix

The admin app at `web/admin/` cannot log in. Diagnose and fix end-to-end.

### E1. Diagnose
- [ ] E1.1 — Read `backend/app/api/admin.py` — confirms `require_admin` checks `current_user.get("role") == "admin"`.
- [ ] E1.2 — Read `backend/app/deps.py` — `get_current_user` returns the row from `users` table. So `role` must be `'admin'` for the admin guard to pass.
- [ ] E1.3 — Query the schema: check whether `users.role` has a CHECK constraint or enum that allows `'admin'`. Run via Supabase MCP: `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.users'::regclass AND contype = 'c';` — find the role constraint.
- [ ] E1.4 — Query: `SELECT id, email, role FROM users WHERE role = 'admin';` — see if any admin user exists.
- [ ] E1.5 — Read `web/admin/src/services/auth.js` and `LoginPage.jsx` to confirm the frontend posts to the correct backend `/auth/login` endpoint, stores the JWT, and attaches it to subsequent requests.

### E2. Fix
- [ ] E2.1 — If the role constraint excludes `'admin'`: add a migration `docs/wave-N-admin-role.sql` with `ALTER TABLE users DROP CONSTRAINT <constraint_name>; ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('client', 'business_owner', 'employee', 'admin'));`. Apply via Supabase MCP. Leave a note in the brief result if the constraint name needs to be confirmed.
- [ ] E2.2 — Create one admin user. Use the user's email `amrbasem37@gmail.com` (from CLAUDE.md `# userEmail`). Steps:
  - In Supabase Auth (via MCP `execute_sql` if needed), check if the user already exists. If yes, just `UPDATE public.users SET role = 'admin' WHERE email = 'amrbasem37@gmail.com';`. If no, the user has to sign up first via the app — flag with `> TODO (HUMAN): sign up amrbasem37@gmail.com via the normal signup, then re-run the admin role assignment SQL`.
- [ ] E2.3 — In `web/admin/src/services/auth.js`, ensure the login flow calls Supabase Auth (or backend `/auth/login`) and stores the session. Fix any bug found.
- [ ] E2.4 — In `web/admin/src/components/ProtectedRoute.jsx`, ensure it checks both session-exists AND role==='admin', redirecting non-admins out.
- [ ] E2.5 — Add a clear error message on admin login: "This account is not an admin" vs "Invalid credentials" vs "Backend unreachable" — three distinct states.
- [ ] E2.6 — Verify admin app starts: `cd web/admin && npm run dev` returns no startup errors. (Run it briefly; kill the process.)

---

## File-creation checklist target

For accountability, ensure the following exist when done. (Counts are approximate; create what's actually needed.)

- `web/launch/` — Vite app scaffolded, builds successfully
- `web/launch/package.json`, `vite.config.js`, `index.html`, `README.md`, `.env.example`, `SECURITY.md`
- `web/launch/src/main.jsx`, `App.jsx`
- `web/launch/src/theme/` (3 CSS files)
- `web/launch/src/lib/` (5 files)
- `web/launch/src/hooks/` (5+ files)
- `web/launch/src/components/` (30+ components)
- `web/launch/src/pages/` (40+ pages matching the routing tree)
- `web/launch/src/components/dashboard/` (analytics charts, KPI cards, export UI)
- `web/launch/public/_headers`, `robots.txt`, `sitemap.xml`
- `web/launch/docs/security-deployment.md`
- Possibly new backend endpoints in `backend/app/api/businesses.py` for analytics/earnings/clients aggregates
- Possibly a new `backend/app/api/api_keys.py` with corresponding `docs/wave-N-api-keys.sql`
- Possibly `docs/wave-N-admin-role.sql`
- `.github/workflows/web-launch-ci.yml`

---

## Final steps

1. **Secret scan:** `grep -rE "(SUPABASE_SERVICE_KEY|sk_live_|sk_test_[a-zA-Z0-9_]{20,}|password\s*=\s*['\"][^'\"]+['\"])" web/launch backend 2>/dev/null` — must be empty.
2. **Build the launch site:** `cd web/launch && npm run build` — must succeed.
3. **Lint:** `cd web/launch && npm run lint` — fix all errors, warnings okay if intentional.
4. **Verify admin still builds:** `cd web/admin && npm run build` — must succeed.
5. **Verify backend still imports cleanly:** `cd backend && "C:/Python314/python.exe" -c "from app.main import app; print('ok')"` — must print `ok`.
6. **Commit per workstream** (5 commits + 1 final wire-up if needed). Push after each.

Suggested commit messages:
- `feat(web/launch): scaffold launch site with Vite + routing + marketing pages (Workstream A)`
- `feat(web/launch): client + business sign-in/sign-up flows (Workstream B)`
- `feat(web/launch): business analytics dashboard + earnings + exports + API keys (Workstream C)`
- `feat(security): brute-force protection, rate limits, CSP headers, Cloudflare playbook (Workstream D)`
- `fix(admin): add admin role to user role constraint, fix login flow, document setup (Workstream E)`

---

## Reporting back

At the end, print a single summary block:

```
SUMMARY
=======
Workstream A: <DONE|PARTIAL|BLOCKED> — <notes>
Workstream B: <...>
Workstream C: <...>
Workstream D: <...>
Workstream E: <...>

Files created: <N>
Files modified: <N>
Lines added (approx): <N>
Commits pushed: <N>
TODOs left for human: <N> (list each with file:line)

Next steps for human:
- <one-line action>
- <one-line action>
```

---

## Success criteria

- [ ] `web/launch/` builds and previews successfully (`npm run build && npm run preview`).
- [ ] Every route in the routing tree renders without error.
- [ ] Login works for client and business roles with the seed accounts (`client@swingby.app`, `business@swingby.app` once recreated in Supabase).
- [ ] Business dashboard shows real data (or a clear empty state when no data).
- [ ] CSV + XLSX exports download a valid file.
- [ ] `npm audit` shows 0 high/critical.
- [ ] Backend `/health` still returns 200.
- [ ] Admin login works for `amrbasem37@gmail.com` after role-assignment SQL runs.
- [ ] No secrets in any committed file.
- [ ] All commits pushed to `origin/main`.

---

## If you're truly blocked

Leave a `> TODO (HUMAN): <what you need>` block in the relevant file and continue with everything else. Never stop the run waiting for the user.

## Go.

Read `CLAUDE.md` first, then `marketing/01-monetization-strategy.md`, then start with Workstream A.
