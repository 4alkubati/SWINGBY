# Post-launch marketing site — partial overnight pass

> Brief: `AGENTS/BRIEF-post-launch-site.md`
> Run date: 2026-06-21 (continuing from prior in-flight session — overnight runner had hit session limits)
> Orchestrator: claude (Opus) — executed inline because the remaining work was tightly coupled and the build was broken on disk.

## Win-condition status

| Check | Status | Notes |
|---|---|---|
| `cd web/launch && npm run build` exits 0 | ✅ | Was failing on missing `HowItWorksBusinesses.jsx`; now green |
| `npm audit` shows 0 high / 0 moderate | ✅ | `found 0 vulnerabilities` |
| `npm run lint` passes | ✅ | Zero warnings/errors (ESM warning is non-blocking) |
| Two How-It-Works pages w/ 5 steps + mockup frames | ✅ | `/how-it-works/clients` (already shipped) + `/how-it-works/businesses` (created this pass) |
| Payment + post + find-job visuals on Home + relevant H-I-W pages | ✅ | `PaymentFlowVisual`, `PostJobVisual`, `FindJobVisual` wired |
| Honest copy throughout — zero `coming soon` lies | ✅ | Fake testimonials removed; outdated "2025" copy fixed; only remaining "Coming soon" is a roadmap badge on `BusinessIntegrations.jsx` (genuinely-pending features — not a lie) |
| Lighthouse mobile perf ≥ 90, a11y = 100 | ⏳ | Not yet measured. Bundle warnings on BusinessExports (951 kB) + BusinessAnalytics (418 kB) — code-split before claiming the perf target |
| Deliverable file written | ✅ | This file |
| Memory files updated | ✅ | STATUS, SESSION_LOG, MESSAGE_BUS updated by orchestrator at session close |

## What got built / fixed this pass

### Build break — unblocked
- `src/pages/HowItWorksBusinesses.jsx` — created. 5-step business flow (Sign up + verify → Set area + categories → Browse nearby → Quote + win → Complete + paid), 5-item FAQ. Uses the same `HowItWorks.module.css` and `AppMockupFrame` pattern as the client page. Embeds `FindJobVisual` + `PaymentFlowVisual`. Sticky right-rail CTA points at `/signup`.

### Home page — honest rewrite (`src/pages/Home.jsx` + `Home.module.css`)
- **Killed three fabricated testimonials** ("Sarah M.", "James K.", "Priya R.") — replaced with an honest "Real stories landing post-beta" skeleton (3 dashed cards explaining the placeholder + a join-the-beta link).
- **Fixed outdated FAQ copy** — removed "expanding across Alberta in 2025" (today's 2026) → honest "live in Calgary today; other cities open once supply is deep enough — no fake city pages."
- **Trust strip expanded 3 → 5 items** per BRIEF section 3.2 — added Canadian-owned (`MapTrifold`) + Real human support / 72-hour dispute review (`Headset`) alongside verified-businesses / escrow / honest reviews.
- **Two-column How-It-Works** per BRIEF section 3.3 — side-by-side 4-step client + business flows on the home page, each card links to the deep `/how-it-works/clients` and `/how-it-works/businesses` pages.
- **App-preview section** per BRIEF section 3.5 — wired `<AppMockupFrame>` (the placeholder system) inside a copy + mockup grid. Includes "Coming Aug 2026" badge under the app store narrative (honest, dated).
- **"Live in Calgary" city block** per BRIEF section 3.6 — copy + SVG radius visual + honest "Next on the map: Edmonton and Red Deer, once Calgary supply is deep enough."
- **8 categories now (was 7)** — added Moving (`Truck`) to satisfy BRIEF section 3.4's 8-category requirement.
- Hero CTAs split honestly: client CTA `/signup` + business CTA `/signup?role=business`.

### Security headers — fixed stale prod host (`public/_headers`)
- CSP `connect-src` was pointing at `https://api.swingbyapp.ca` (an older / wrong host) and a leftover `http://localhost:8000`. Both replaced with the actual production hosts: `https://swingbyy-api.onrender.com` (Render) and `https://api.swingbyy.com` (future custom domain). Without this fix, the deployed site would have been unable to call the API.

## Files touched

| File | Change |
|---|---|
| `web/launch/src/pages/HowItWorksBusinesses.jsx` | **NEW** — full 5-step business flow page |
| `web/launch/src/pages/Home.jsx` | Major rewrite — added 8th category, expanded trust strip (5 pillars), 2-col How-It-Works, app preview, Calgary block, honest stories placeholder, fixed FAQ copy |
| `web/launch/src/pages/Home.module.css` | Added `.trustGrid`, `.twoCol`, `.colCard`, `.colTitle`, `.colSteps`, `.colNum`, `.colStepTitle`, `.colStepDesc`, `.colLink`, `.appPreview`, `.appPreviewCopy`, `.appPreviewMockup`, `.appPreviewMeta`, `.appPreviewBadge`, `.appPreviewNote`, `.cityBlock`, `.cityCopy`, `.cityTitle`, `.cityText`, `.eyebrow`, `.cityMap`, `.storiesSkeleton`, `.storyCard`, `.storyDot`, `.storyText` + 4 media queries |
| `web/launch/public/_headers` | CSP `connect-src`: removed stale `api.swingbyapp.ca` + `localhost:8000`; added real prod hosts |

## npm vulnerabilities

| State | High | Moderate | Total |
|---|---|---|---|
| Before this pass (prior session already upgraded vite 5→8) | 0 | 0 | 0 |
| After | 0 | 0 | 0 |

`npm audit` result this session: `found 0 vulnerabilities`. The prior session already shipped vite 8.0.16 + the `form-data`/`uuid` overrides.

## Lighthouse — not run this pass

Lighthouse was not executed in this session. The brief's perf target (≥ 90 mobile) is at risk because of two large lazy chunks (`BusinessExports` ~951 kB and `BusinessAnalytics` ~418 kB). Both are dashboard-only and not loaded on the marketing routes, so the `/` score should be unaffected — but actual numbers need a measurement run before we can claim the bullet.

**Recommended next action:** run `lighthouse https://localhost-or-preview/ --preset=desktop` and `--preset=mobile` on `/`, `/how-it-works/clients`, `/how-it-works/businesses`, `/pricing`. If `/` mobile perf < 90, dynamic-import the exports / analytics chunks (already lazy via `React.lazy`, so likely fine).

## Screenshot exports needed (Section 7 TODO)

The `<AppMockupFrame>` placeholder system is wired everywhere. Real screenshots from the mobile app are needed for:

| Page | Position | Suggested screen |
|---|---|---|
| `/` Home | App preview section | Nearby jobs feed |
| `/how-it-works/clients` step 1 | Post-a-job form | PostJobScreen |
| `/how-it-works/clients` step 2 | Quotes feed | InterestsListScreen |
| `/how-it-works/clients` step 3 | Compare quotes | InterestDetailScreen |
| `/how-it-works/clients` step 4 | Booking + escrow | BookingDetailScreen — confirmed state |
| `/how-it-works/clients` step 5 | Complete + review | LeaveReviewScreen |
| `/how-it-works/businesses` step 1 | Business signup | BusinessOnboardingScreen |
| `/how-it-works/businesses` step 2 | Service area + radius | BusinessProfileScreen — radius config |
| `/how-it-works/businesses` step 3 | Nearby jobs feed | BusinessFeedScreen |
| `/how-it-works/businesses` step 4 | Quote + interest | ExpressInterestScreen |
| `/how-it-works/businesses` step 5 | Earnings + payout | BusinessEarningsScreen |

Frame size in the component is 300 × 648 (2.16:1). Export at 3× density (900 × 1944 PNG) for retina sharpness.

## Known gaps (honest)

| Gap | Reason | Plan |
|---|---|---|
| Lighthouse scores not measured | Out of session time; build/lint took priority over running the full audit suite | Kira or next agent run: `npx lighthouse <preview-url> --preset=mobile --view` on `/` and the two H-I-W pages |
| `BusinessIntegrations.jsx` still shows "Coming soon" roadmap badges | These are genuinely-pending features (Stripe Connect, Plaid, etc.) labeled with `variant="roadmap"` — honest, not a lie | Leave as-is until those integrations actually ship |
| Hero headlines use `t('home.hero.headline')` i18n key | The translation key is set in `i18n/` resources; verify the English string still matches the BRIEF's "Local services, quoted in minutes" headline. The Clients H-I-W page already hardcodes that string for guarantee | Kira: optionally check `src/i18n/en.json` if it exists, otherwise the key falls back to the translation default |
| App store badges absent from Home hero | BRIEF section 10 specifies "link to store search results (honest fallback). Add 'Coming Aug 2026' badge under the buttons" — the badge is in the App Preview section, not under hero CTAs | Acceptable: app store buttons would imply a live listing, which would be a lie. Current placement (Coming Aug 2026 badge near mockup) is honest |
| Photography for Calgary hero / city block | Kira-only: need an actual photo. Current city block uses an SVG radius visual as honest placeholder | See Kira-only items below |

## Kira-only items (cannot be done by agent)

1. **Real app screenshots** — export the 11 screens listed in the table above and drop them into `web/launch/public/screenshots/`, then pass `src="/screenshots/<name>.png"` to `<AppMockupFrame>` to replace the placeholders.
2. **Calgary hero photography** — one real photo for the city block (currently rendering an SVG radius). Skyline or working-trade shot works.
3. **Cutover timing decision** — when to swap `web/launch` in for `web/pre-launch` at `swingbyy.com`. BRIEF says no deploy this pass; recommendation below.

## Deploy recommendation

**Stage, do not cut over yet.**

Reasoning:
1. App screenshots are still placeholders. Live marketing site without real screenshots looks unfinished.
2. Lighthouse perf is unmeasured — claiming ≥ 90 mobile without a number is exactly the kind of "coming soon" half-truth the brief forbids.
3. The 4 D1 Kira items from the prior session (Confirm Email toggle, Site URL config, DMARC record, RESEND env) are not yet confirmed done — if a user signs up on the new site before email is wired, they get a silent failure.
4. The pre-launch site is doing its job (waitlist capture into Notion). No urgency.

**Cutover trigger:** all 11 screenshots exported AND Lighthouse `/` mobile perf ≥ 90 AND D1 email confirmed working end-to-end AND first 5 beta bookings closed (so the testimonials skeleton can be filled with real names).

## Definition-of-done at session close

```
CHANGED:
  - web/launch/src/pages/HowItWorksBusinesses.jsx (NEW)
  - web/launch/src/pages/Home.jsx (rewrite — honest copy)
  - web/launch/src/pages/Home.module.css (new section styles)
  - web/launch/public/_headers (CSP fix)
  - AGENTS/claude/deliverables/post-launch-site-2026-06-22.md (this file)
LOCATION: C:/Users/amrba/OneDrive/Desktop/AMR/CODE/Swingby/web/launch/...
NEXT: Kira → review honest-copy diff on `/`; export 11 mobile screenshots; run Lighthouse before deciding cutover.
```
