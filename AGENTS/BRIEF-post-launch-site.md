# Agent brief — Post-launch marketing site rebuild (web/launch)

> Run via the AGENTS orchestrator. Follow `claude/config/DISPATCH_GATE.md` (all 7 layers). Apply skills: brainstorming, writing-plans, two-stage-review, verification-before-completion, systematic-debugging, learning-loop.
> Goal: rebuild `web/launch/` into a polished marketing site we can swap in at public launch (Aug 31). Honest copy, mobile-first, conversion-focused. Preserve brand consistency with `web/pre-launch/` (currently live at swingbyy.com).

## Hard constraints (read first)

- **No secrets in code or chat.** `.env` stays gitignored.
- **Payment stays sandbox.** Show payment visuals but never wire live Stripe keys.
- **No `coming soon` lies.** Beta-scoped gaps must be called out honestly the way `web/pre-launch` does (audit at `AGENTS/claude/deliverables/page-completeness-audit-2026-06-20.md`).
- **Build must stay green** after every task. If `npm run build` fails, fix before next task — never mark a task done on a broken build.
- **No deploys.** This is local rebuild only — Kira decides cutover timing later.

## Safeguards — debug every line + auto-compact

For every code change in this brief:
1. **Read the file before editing.** Confirm the diff target exists and you understand surrounding context.
2. **Verification-before-completion.** After every edit: `npm run build` + lint must pass. If lint config is missing, add one (eslint react + a11y).
3. **Re-read the file after editing** to confirm the change landed as intended.
4. **Context watermark.** When your conversation context exceeds 128k tokens, STOP, write a progress checkpoint to `AGENTS/claude/memory/SESSION_LOG.md` (what's done, what's next, files touched), then continue with a compacted summary. Do not let the context fill until you lose state.
5. **Blocked = exit cleanly.** If you hit a step that needs Kira (account, key, manual decision), write `NEEDS-KIRA: <specific ask>` to `memory/STATUS.md` and stop. Do not invent values.

---

## 1. Pre-flight + dependency hygiene

- Inspect `web/launch/package.json` and `package-lock.json`. Current 5 npm vulns (3 moderate, 2 high) all live in dev tooling (vite, esbuild, form-data, babel).
- Upgrade vite 5 → 8 (semver-major). Run `npm install`, then `npm audit fix --force`, then `npm audit` to verify 0 high/0 moderate.
- Run `npm run build`. If it fails on vite 8 breaking changes, fix the config (`vite.config.js`). Common breaks: `build.lib` changes, `server` config, `define` types.
- Commit-ready state: build green, audit clean.

## 2. Information architecture + nav

Two top-level audiences:
- **Clients** (people who need a service)
- **Businesses** (solo trades and small companies)

Implement separate menus / CTAs in the header:
- Persistent top bar: logo · `How it works (Clients)` · `How it works (Businesses)` · `Pricing` · `Categories` · `Calgary` · `About` · `Help` · `Log in` · `Get started` (primary CTA)
- Mobile nav: hamburger with same items, audience selector at the top (`I'm a client` / `I'm a business owner` toggle that swaps featured CTAs)

## 3. Home page — conversion-focused

Required sections in order:
1. **Hero** — headline ("Local services, quoted in minutes"), one-line subhead, two CTAs (`Post a job — it's free` for clients, `Get more jobs` for businesses), badge "Now live in Calgary".
2. **Trust strip** — 4–5 trust signals (verified businesses, escrow protection, Canadian-owned, real human support, money-back guarantee for non-completed jobs). Pattern inspiration: HomeStars trust badges.
3. **How it works — two columns side by side** — client column (Post → Get quotes → Book → Pay safely) + business column (Browse → Quote → Get hired → Get paid). Each step illustrated with an app screenshot mockup.
4. **Categories grid** — 8 top categories with icons (Cleaning, Plumbing, Electrical, Landscaping, Painting, Carpentry, Handyman, Moving). Link to `/categories/:slug`.
5. **App preview** — phone-frame mockup showing the mobile app's Home/Feed. Use SVG-bordered placeholder if real screenshots are not yet exported — see Section 7.
6. **Live in Calgary** — city block with photo, "expanding to <next 3 cities>".
7. **Testimonials placeholder** — leave honest skeleton ("Real stories landing post-beta") rather than fake quotes.
8. **Footer** — full sitemap (audience-grouped), contact, legal links, social.

## 4. How It Works pages (two pages)

`/how-it-works/clients` and `/how-it-works/businesses`.

Each page has:
- 5-step numbered flow with one app screenshot mockup per step
- Honest copy explaining what happens at each step (no marketing-speak that lies about features)
- "Data interaction" callout boxes (see Section 5)
- Sticky right-rail CTA that converts to the audience's flow

Client flow steps:
1. Post a job (form preview screenshot — fields: category, address, budget, timing, photos)
2. Get matched quotes (feed mockup — businesses tap "Express interest" with quoted price)
3. Pick your pro (compare quotes, ratings, profile)
4. Book + pay safely (escrow callout: 50% on confirmation held by SwingBy)
5. Job done → release payment + leave a review (escrow release callout: business gets 90% — SwingBy takes 10% on the back half)

Business flow steps:
1. Sign up + verify (license status pending → manual verification — say so honestly)
2. Set service area + categories (Haversine radius preview)
3. Browse Calgary jobs nearby (feed mockup)
4. Quote + win the job (interest UX)
5. Complete + get paid (escrow split visual)

## 5. Data interaction visuals (required, called out by Kira)

Three explicit visuals, embedded where they're relevant. Each one is a small framed diagram or SVG, not a video, not a fake-screenshot:

**A. Payment flow (escrow)**:
- Client pays $X → SwingBy holds 100%
- Booking confirmed → 50% released to business (visible release event)
- Job complete → remaining 50% released minus 10% SwingBy fee → business gets 90% total
- Cancel before 48h = 25% penalty; ≤48h = 50% penalty (named honestly)

**B. Posting a job (client side)**:
- Form preview screenshot
- Promise: "5 minutes to your first quote in Calgary"
- Below: "Average response time: <X> min" (placeholder until we have real data — use `--` until we measure)

**C. Finding a job (business side)**:
- Feed preview screenshot — nearby jobs sorted by distance + recency
- "Tap to express interest with your quote"
- Pricing transparency: "SwingBy charges 10% only when you get paid. No subscription, no per-quote fee."

## 6. Other required pages (build / preserve)

- `/pricing` — clear, single-page pricing for both sides. Clients: free. Businesses: 10% commission on completed jobs only.
- `/categories` (index) + `/categories/:slug` (8 per Section 3)
- `/cities` + `/cities/calgary` (honest "more cities coming" — no city pages we can't back up)
- `/safety` — verification + escrow + dispute resolution + ID checks (where applicable, honestly)
- `/about` · `/press` · `/careers` (real careers post if we're hiring; honest "not hiring yet" otherwise)
- `/help` (index) + `/help/:slug` — reuse the 5–7 articles already on pre-launch (Getting Started, Posting a Job, Quoting, Payments, Cancellations, Disputes, Account)
- `/contact` — real form wired to `POST /contact` backend endpoint (same as pre-launch shipped 2026-06-20)
- `/privacy`, `/terms`, `/cookies`, `/accessibility` — copy from pre-launch (already legal-reviewed)
- `/404`, `/500`, `/maintenance` — match pre-launch tone

## 7. App mockup images (placeholder system)

Real exported screenshots will come later — do NOT block on them tonight.

- Build a reusable `<AppMockupFrame>` component: iPhone-shaped frame, drop-shadow, takes a `src` prop. When `src` missing, render a labeled SVG placeholder (`<rect>` with category label + "screenshot pending") so layout doesn't shift later.
- Use this component in: Hero, both How-It-Works pages, Home App Preview section.
- File the screenshot exports as a TODO in `AGENTS/claude/deliverables/post-launch-site-2026-06-22.md` — list of exact screen names needed.

## 8. Accessibility + performance

- WCAG 2.1 AA. Run axe-core in dev, fix all violations.
- Lighthouse mobile: **perf ≥ 90, a11y = 100, best-practices = 100, SEO ≥ 95** on `/`. Tune images, lazy-load below the fold, code-split routes.
- All images: real alt text or `alt=""` for decorative. No placeholder alt copy.
- Keyboard navigable header + mobile menu.
- Skip-link to main content.

## 9. CSP + security headers

- Preserve `public/_headers` (Cloudflare/Netlify format) from current `web/launch`.
- CSP: tighten if loose. Allow only what's needed: self, Supabase, Plausible, Sentry (if used).
- No inline scripts without nonces.

## 10. Honest beta-scoped gaps (call them out, do not lie)

- App store badges → link to store search results (honest fallback). Add "Coming Aug 2026" badge under the buttons.
- "Live in Calgary" — true today. "Expanding to <city>" — list only cities with a real waitlist signal.
- Testimonials → empty skeleton, not invented quotes.
- Real-time stats ("X jobs posted today") → only if backed by a real query; otherwise show "Now in beta".

## 11. Deliverable

Write `AGENTS/claude/deliverables/post-launch-site-2026-06-22.md` with:
- What was built (pages + components)
- Files touched (paths)
- npm vulns before → after
- Lighthouse scores (table)
- Screenshot exports needed (the placeholder TODO list from Section 7)
- Known gaps + reasoning
- Deploy decision recommendation (swap in now vs stage)

## Kira-only items (cannot be done by agent — surface, do not attempt)

- Real app screenshots exported from mobile (the Section 7 list)
- Photography for Calgary hero / city block
- Decision on cutover timing (replace pre-launch on swingbyy.com at Aug launch vs sooner)

## Definition of done (overnight pass)

- [ ] `cd web/launch && npm run build` exits 0
- [ ] `cd web/launch && npm audit` shows 0 high / 0 moderate
- [ ] Lighthouse mobile on `/`: perf ≥ 90, a11y = 100
- [ ] Two How-It-Works pages exist with 5 steps each and mockup frames
- [ ] Payment + post + find-job visuals present on Home + relevant How-It-Works pages
- [ ] Honest copy throughout — zero `coming soon` lies
- [ ] Deliverable file written
- [ ] `memory/STATUS.md`, `memory/SESSION_LOG.md`, `memory/MESSAGE_BUS.md` updated
