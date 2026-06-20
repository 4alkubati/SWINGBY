# Autonomous 100-Task Background Run — Wave 2

This is the SECOND wave of background polish tasks. The first wave (`autonomous-polish-100.md`) may still be running or completed. **Read its summary commit messages first to avoid duplicate work** — if a task feels like it was already done, skip it and move on.

Same safety rules apply. Read the "HARD RULES" section first.

---

## HARD RULES — read twice

1. **NEVER touch `.env*`, `.claude/secrets/*`** — credential files.
2. **NEVER call `mcp__n8n__*`** — even if it appears available. The founder is wiring it manually.
3. **NEVER call Supabase write tools** (`execute_sql`, `apply_migration`). Reads OK.
4. **NEVER modify these live files**: `backend/app/api/auth.py`, `admin.py`, `deps.py`, `main.py`, `supabase_client.py`, `limiter.py`.
5. **NEVER kill running processes** (the founder may have npm/uvicorn servers running).
6. **NEVER commit secrets** of any kind. If you find one in code, leave a `// SECURITY:` comment.
7. **NEVER use destructive git** (`reset --hard`, `push --force`, `clean -f`, branch deletes).
8. **Match existing voice** per `marketing/09-brand-guidelines.md`. No "unlock," "leverage," "ecosystem," "revolutionary."
9. **Commit per workstream** with descriptive messages. Push after each.
10. **Stop at ~70% context** — finish the current task, commit + push what's done, print SUMMARY, exit.

---

## Safe sandboxes

- `web/launch/src/**`, `web/pre-launch/src/**`
- `marketing/**`, `privacy-and-security/**`
- `mobile/src/**`
- `docs/**`
- `backend/app/api/*.py` — only NEW files
- Any new test files, any new doc files

---

## Workstream K — Launch comms package (10 tasks)

- [ ] K1 — Create `marketing/launch/day-of-script.md`: hour-by-hour script for launch day (8am MT → midnight) with exact actions, channels, copy snippets.
- [ ] K2 — Create `marketing/launch/waitlist-launch-email.md`: 3 variants of "we're live" email to send to the existing waitlist.
- [ ] K3 — Create `marketing/launch/launch-day-instagram.md`: 5 IG posts for launch day (announce, behind-scenes, founder note, customer welcome, recap).
- [ ] K4 — Create `marketing/launch/launch-day-linkedin.md`: 3 LinkedIn posts (founder personal, company page, network ask).
- [ ] K5 — Create `marketing/launch/launch-day-twitter.md`: 1 launch thread (10 tweets) + 5 standalone tweets.
- [ ] K6 — Create `marketing/launch/founder-friends-asks.md`: 50 specific asks to send to friends/network ("would love a download + review," "share with one neighbour," "post about it if it resonates"). Include exact DM/email copy.
- [ ] K7 — Create `marketing/launch/launch-week-blog.md`: a 1500-word "why I built SwingBy" founder post for the SwingBy blog, day 1.
- [ ] K8 — Create `marketing/launch/day-7-recap.md`: template for day-7 transparent recap (numbers + lessons). Leave numbers as `<X>` for filling in.
- [ ] K9 — Create `marketing/launch/day-30-recap.md`: same shape, deeper analysis. Template only.
- [ ] K10 — Create `marketing/launch/anti-checklist.md`: things NOT to do on launch day (no big feature changes, no shipping risky code, no skipping smoke test, no quiet panic).

---

## Workstream L — Customer Support kit (10 tasks)

- [ ] L1 — Create `marketing/support/knowledge-base.md`: 30 foundational FAQs covering signup, posting a job, payment, escrow, disputes, cancellations, reviews, messaging, business onboarding, app permissions.
- [ ] L2 — Create `marketing/support/response-templates.md`: 20 canned response templates for common support tickets (account locked, payment issue, dispute, complaint, refund request, etc.). Brand-voice, no copy-paste corporate feel.
- [ ] L3 — Create `marketing/support/escalation-matrix.md`: who handles what, when to escalate to founder, when to call legal.
- [ ] L4 — Create `marketing/support/dispute-playbook.md`: step-by-step for adjudicating a client-vs-business dispute. Decision tree.
- [ ] L5 — Create `marketing/support/refund-decision-tree.md`: when to refund, when not to, edge cases.
- [ ] L6 — Create `marketing/support/business-no-show-playbook.md`: what to do when a business doesn't show up to a booked job.
- [ ] L7 — Create `marketing/support/client-no-show-playbook.md`: same for client side.
- [ ] L8 — Create `marketing/support/business-quality-review.md`: when to suspend a low-rated business, with thresholds.
- [ ] L9 — Create `marketing/support/csat-survey.md`: 5-question post-support survey copy.
- [ ] L10 — Create `marketing/support/README.md`: index + "how to use this folder."

---

## Workstream M — Press + Media outreach package (10 tasks)

- [ ] M1 — Create `marketing/press/press-kit.md`: the full press kit text (boilerplate, founder bio, traction stats, screenshots list, logo links, quotes).
- [ ] M2 — Create `marketing/press/pitch-calgary-herald.md`: tailored 4-paragraph pitch to Calgary Herald business desk + specific reporter targets.
- [ ] M3 — Create `marketing/press/pitch-betakit.md`: tailored pitch to BetaKit (Canadian tech).
- [ ] M4 — Create `marketing/press/pitch-mobilesyrup.md`: tailored to MobileSyrup.
- [ ] M5 — Create `marketing/press/pitch-ctv-calgary.md`: tailored to CTV Calgary (broadcast — different angle, human interest).
- [ ] M6 — Create `marketing/press/press-release-launch.md`: a formal press release for launch day.
- [ ] M7 — Create `marketing/press/founder-bio.md`: 100-word and 300-word versions of founder bio.
- [ ] M8 — Create `marketing/press/quotes.md`: 10 founder quotes journalists can pull (about Calgary, marketplaces, trust, escrow, the mission).
- [ ] M9 — Create `marketing/press/journalist-targets.csv`: 30-row CSV with Name, Outlet, Beat, Twitter, Email pattern, Why-they-fit columns. Use realistic placeholder values, mark "RESEARCH NEEDED" where unknown.
- [ ] M10 — Create `marketing/press/follow-up-cadence.md`: when to follow up if a journalist doesn't reply (3 days, 7 days, 14 days — different copy each time).

---

## Workstream N — Investor / advisor materials prep (10 tasks)

Even if not raising yet, having this ready makes opportunistic conversations easy.

- [ ] N1 — Create `marketing/investor/one-pager.md`: a 1-page summary (problem, solution, market, traction, team, ask).
- [ ] N2 — Create `marketing/investor/pitch-deck-outline.md`: 12-slide pitch deck outline with slide-by-slide content brief.
- [ ] N3 — Create `marketing/investor/financial-model-template.md`: a markdown table model — 36 months of revenue, costs, headcount projection. Use placeholder values, document assumptions.
- [ ] N4 — Create `marketing/investor/cap-table-template.md`: a starter cap table structure (founder 100% pre-raise, with rows for future SAFE/seed/Series A).
- [ ] N5 — Create `marketing/investor/use-of-funds.md`: what each $250k / $500k / $1M raise would buy (specific hires, runway).
- [ ] N6 — Create `marketing/investor/competitor-matrix.md`: deep competitor analysis (Thumbtack, TaskRabbit, HomeStars, Kijiji, FB Marketplace, Yelp). Pricing, model, geography, weakness vs SwingBy.
- [ ] N7 — Create `marketing/investor/market-sizing.md`: TAM/SAM/SOM for Calgary services, then Canada services. Show methodology.
- [ ] N8 — Create `marketing/investor/risks-and-mitigations.md`: candid list of 10 risks + mitigation plan for each.
- [ ] N9 — Create `marketing/investor/advisor-target-list.md`: 20 names of marketplace/Calgary-tech advisors to approach, with rationale.
- [ ] N10 — Create `marketing/investor/README.md`: how to use the folder + warning that all numbers are placeholders.

---

## Workstream O — Deep content production round 2 (10 tasks)

Wave 1 may have done weeks 1-4 of IG. Continue.

- [ ] O1 — Create `marketing/content-library/instagram-week-5-8.md`: 28 more IG posts (full month).
- [ ] O2 — Create `marketing/content-library/instagram-week-9-12.md`: 28 more.
- [ ] O3 — Create `marketing/content-library/tiktok-30-scripts.md`: 30 short-video scripts (30s each), categorized by pillar.
- [ ] O4 — Create `marketing/content-library/blog-30-posts.md`: 30 blog post titles + 100-word outlines each, organized by SEO target.
- [ ] O5 — Create `marketing/content-library/email-newsletter-templates.md`: 5 newsletter formats (weekly recap, biz spotlight, client tips, behind-build, "ask me anything").
- [ ] O6 — Create `marketing/content-library/founder-twitter-30.md`: 30 founder Twitter/X posts (build-in-public, takes, marketplace observations).
- [ ] O7 — Create `marketing/content-library/instagram-stories-bank.md`: 50 short story prompts/templates (polls, behind-scenes, "this or that," etc.).
- [ ] O8 — Create `marketing/content-library/reels-concepts.md`: 20 Reels concepts with hook, beat structure, on-screen text.
- [ ] O9 — Create `marketing/content-library/founder-linkedin-30.md`: extend or create — 30 more LinkedIn posts if wave 1 already did this, create 30 new ones from a different angle (founder personal).
- [ ] O10 — Create `marketing/content-library/repurpose-matrix.md`: 1 blog post → 3 IG → 1 LI → 1 TT → 5 tweets. With a worked example.

---

## Workstream P — Brand assets + design system polish (10 tasks)

- [ ] P1 — Audit `web/launch/src/theme/tokens.css` — confirm all color variables are documented; add inline comments for "use case" per token.
- [ ] P2 — Create `marketing/brand/color-palette.md`: hex values + usage guide for each token in tokens.css.
- [ ] P3 — Create `marketing/brand/typography.md`: heading hierarchy, body sizes, line heights, font pairings — from typography.css.
- [ ] P4 — Create `marketing/brand/voice-examples.md`: 20 examples of "we say this, not that" — concrete A/B copy comparisons.
- [ ] P5 — Create `marketing/brand/logo-usage.md`: clear-space rules, minimum sizes, do/don't list. Reference SVGs if they exist in repo, mark TODO if not.
- [ ] P6 — Create `marketing/brand/email-signature.md`: standardized email signature templates for founder + future support@ + biz dev.
- [ ] P7 — Create `marketing/brand/social-bios.md`: 100-char bio for Twitter, 150-char for IG, full company description for LinkedIn + FB Page.
- [ ] P8 — Audit web/launch components for inconsistent button styles. List any orphans in `marketing/brand/audit-buttons.md`.
- [ ] P9 — Create `marketing/brand/imagery-direction.md`: photography + illustration style guide. No stock-photo-people-handshaking. Real Calgary, real tradespeople.
- [ ] P10 — Create `marketing/brand/swag-ideas.md`: 10 low-cost swag/giveaway ideas for early users (stickers, t-shirts, mugs — with cost estimates).

---

## Workstream Q — Backend hardening (NEW files only) (10 tasks)

- [ ] Q1 — Create `backend/app/api/health.py` skeleton — comprehensive health endpoint reporting DB, Supabase, env vars present. Register in main.py with one added line.
- [ ] Q2 — Create `backend/app/api/version.py` — returns git SHA, deploy timestamp, env. New file.
- [ ] Q3 — Create `docs/wave-8-audit-log.sql` migration: audit_logs table with user_id, action, resource_type, resource_id, ip, timestamp. Mark `> TODO (HUMAN): apply this migration in Supabase`.
- [ ] Q4 — Create `backend/app/api/audit.py` skeleton (commented-out routes for now) that would write to the audit_logs table.
- [ ] Q5 — Add `backend/app/middleware/request_id.py` — generates X-Request-ID for every request, attaches to logs. Wire in main.py.
- [ ] Q6 — Add `backend/app/middleware/structured_logging.py` — wraps every response with timing + status logging via structlog.
- [ ] Q7 — Create `docs/wave-9-soft-delete.sql` migration — adds `deleted_at` to users, businesses, employees, service_posts. Soft delete pattern. Mark `> TODO (HUMAN): apply this migration`.
- [ ] Q8 — Create `backend/tests/test_health.py` — unit test for the new health endpoint.
- [ ] Q9 — Create `backend/tests/conftest.py` if missing — pytest fixtures for test client + mock Supabase.
- [ ] Q10 — Create `backend/README.md` (or update if exists) — run instructions, env vars, test commands, project structure.

---

## Workstream R — Mobile app polish round 2 (10 tasks)

- [ ] R1 — Run mobile lint and capture findings to `mobile/docs/lint-findings.md`.
- [ ] R2 — Add error boundaries around every navigator stack in `mobile/src/navigation/*Navigator.js`.
- [ ] R3 — Audit `mobile/src/screens/` for hardcoded color values that should be theme tokens. List in `mobile/docs/color-audit.md`.
- [ ] R4 — Add accessibility labels to all `<TouchableOpacity>` icon-only buttons across screens.
- [ ] R5 — Audit for unhandled async errors. Wrap async event handlers with try/catch + toast.
- [ ] R6 — Add platform-aware shadows/elevation using `Platform.select`.
- [ ] R7 — Add deep link configuration documentation in `mobile/docs/deep-links.md` (swingby://booking/:id, swingby://invite/:code).
- [ ] R8 — Create `mobile/docs/manual-test-script.md` — golden path test script for QA (10 specific user flows to verify before each release).
- [ ] R9 — Add app version + build number footer to `SettingsScreen` reading from expo-application.
- [ ] R10 — Create `mobile/docs/release-checklist.md` — checklist for every TestFlight / Play Store release.

---

## Workstream S — Operations + admin readiness (10 tasks)

- [ ] S1 — Create `docs/ops/legal-checklist.md` — pre-launch legal items (business registration, GST/HST threshold, CASL, terms acceptance flow).
- [ ] S2 — Create `docs/ops/banking-checklist.md` — opening a business bank account (chequing, savings, Stripe payouts target).
- [ ] S3 — Create `docs/ops/insurance-checklist.md` — what kinds of insurance to look into (general liability, cyber/E&O, D&O if raising).
- [ ] S4 — Create `docs/ops/tax-checklist.md` — annual filing checklist (corporate tax, payroll if hiring, GST/HST remittance).
- [ ] S5 — Create `docs/ops/hiring-checklist.md` — first 3 hires you'd make + cost estimates.
- [ ] S6 — Create `docs/ops/vendor-list.md` — list of all third-party services (Supabase, Render, Cloudflare, n8n, Notion, Slack, OpenAI, etc.) with cost estimates + admin contacts.
- [ ] S7 — Create `docs/ops/backup-rotation.md` — what gets backed up where, how often, who tests restore.
- [ ] S8 — Create `docs/ops/admin-account-management.md` — list of all admin accounts across services, who has what, rotation schedule.
- [ ] S9 — Create `docs/ops/founder-1-pager.md` — print-and-pin: vision, current focus, next milestone, current blockers.
- [ ] S10 — Create `docs/ops/README.md` — index of the ops folder.

---

## Workstream T — Pre-launch testing + smoke checks (10 tasks)

- [ ] T1 — Create `docs/testing/golden-path-checklist.md` — list of 30 golden-path user flows to test before launch (client signs up, posts job, gets accepted, pays, completes, reviews — same for business).
- [ ] T2 — Create `docs/testing/edge-cases.md` — 50 edge cases to verify (empty states, network down, slow network, simultaneous bookings, full inbox, expired session, etc.).
- [ ] T3 — Create `docs/testing/cross-browser.md` — browsers/devices to verify (Chrome, Safari, Firefox, mobile Safari, Android Chrome) with notes per browser.
- [ ] T4 — Create `docs/testing/security-smoke.md` — manual security checks before launch (try SQL injection in search, XSS in profile, IDOR on booking detail, etc.).
- [ ] T5 — Create `docs/testing/performance-targets.md` — Core Web Vitals targets per page (LCP <2.5s, INP <200ms, CLS <0.1), Lighthouse score targets.
- [ ] T6 — Create `docs/testing/a11y-checklist.md` — WCAG 2.1 AA checklist with how to verify each item.
- [ ] T7 — Create `docs/testing/api-load-test.md` — outline of a basic load test plan (k6 or Artillery script structure). Don't run the test.
- [ ] T8 — Create `docs/testing/disaster-recovery-drill.md` — pretend incident: "Supabase is down for 1 hour." Walk through response.
- [ ] T9 — Create `docs/testing/data-deletion-flow.md` — manual test plan for user data deletion (the PIPEDA compliance need).
- [ ] T10 — Create `docs/testing/README.md` — index.

---

## Final steps

1. Secret scan:
   ```
   grep -rE "(sk_live|sk_proj-[a-zA-Z0-9_-]{20,}|xoxb-|xoxp-|EAA[a-zA-Z0-9_]{20,}|secret_[a-zA-Z0-9_]{20,}|password\s*=\s*['\"][^'\"]+)" marketing/ docs/ backend/ web/ mobile/ 2>/dev/null | head -20
   ```
   Must be empty (or only show the existing `SECURITY:` comments).
2. Verify `git status` shows only intended files.
3. Commit per workstream, push after each.

---

## Reporting

Print at the end:

```
WAVE 2 SUMMARY
==============
Started: <ISO>
Stopped: <ISO>
Reason for stop: <completed all | context budget | blocker>

Workstreams:
  K — launch comms:        <N/10>
  L — customer support:    <N/10>
  M — press + media:       <N/10>
  N — investor materials:  <N/10>
  O — content round 2:     <N/10>
  P — brand assets:        <N/10>
  Q — backend hardening:   <N/10>
  R — mobile round 2:      <N/10>
  S — operations:          <N/10>
  T — pre-launch testing:  <N/10>
  Total: <N/100>

Files created: <N>
Files modified: <N>
Commits pushed: <N>

TODOs left for human: <list>
```

---

## Go

Read `CLAUDE.md` first to anchor on voice. Then check the recent commit messages with `git log --oneline -20` to see if Wave 1 covered anything you might duplicate. Then start with Workstream K (highest leverage if launch is soon).

If a task feels duplicate of Wave 1, skip it — leave a one-line comment in the relevant Wave 1 file noting "Wave 2 considered extending — no change needed."

Stop at 70% context. Push everything cleanly. Print SUMMARY.
