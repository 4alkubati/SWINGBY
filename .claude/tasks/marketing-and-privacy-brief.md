# Autonomous Task Brief — SwingBy Marketing + Privacy/Security Build-Out

You are operating autonomously on the SwingBy project. The user has approved bypass-permissions mode. Your job is to finish the marketing folder, build the privacy-and-security folder from scratch, then commit and push to GitHub. Work in long uninterrupted stretches — do not stop to ask questions unless something is genuinely blocking.

---

## Mission

Take the SwingBy project from "product built" to "marketing- and compliance-ready for public launch." Produce all the content listed below to a high standard, then ship it to GitHub.

The user has already vetted the high-level plan. Your job is execution.

---

## What's already done (DO NOT REDO)

The following files already exist at high quality. Do not rewrite them:

- `marketing/README.md`
- `marketing/01-monetization-strategy.md`
- `marketing/02-pricing.md`
- `marketing/03-go-to-market.md`
- `marketing/04-positioning-and-messaging.md`
- `marketing/05-launch-checklist.md`
- `marketing/06-growth-playbook.md`
- `marketing/07-content-calendar.md`
- `marketing/08-kpis-and-metrics.md`
- `marketing/09-brand-guidelines.md`
- `marketing/10-partnerships.md`

Read these first to understand the established voice, structure, and decisions. New content must be consistent with them.

---

## Project context you must read before starting

1. `CLAUDE.md` (project root) — master context. Read this first.
2. `marketing/01-monetization-strategy.md` through `marketing/10-partnerships.md` — established marketing context.
3. `backend/app/main.py` and `backend/app/api/` — what the backend actually does (so privacy/security docs reflect reality).
4. `docs/rls_policies.sql` — what RLS is applied (for security overview).

---

## Constraints — non-negotiable rules

1. **No secrets in any file.** Never commit `.env`, API keys, Supabase service keys, Stripe keys, or test credentials. The `.gitignore` already excludes `.env` and `SEED ACCOUNT FOR TESTING*`.
2. **No code changes.** This brief is content/docs only. Do not edit backend, mobile, or web source files unless a file you create needs to reference a real file path — and even then, only read those files, don't modify them.
3. **No new dependencies installed.** No npm install, pip install, etc.
4. **Voice consistency.** Match the voice in existing marketing files: direct, warm, confident, plain. No "revolutionary," "unlock," "leverage," "synergy," "ecosystem." Short sentences. One idea per sentence.
5. **Truth over puffery.** If the product doesn't have a feature yet, say so. Don't invent traction numbers. Use placeholders like `[X]` for numbers the founder will fill in.
6. **Markdown formatting.** All deliverables in clean Markdown. Use tables for structured data. Use headings consistently (`##` for sections, `###` for subsections).
7. **Cross-link aggressively.** Every doc should link to related docs in the folder.
8. **Don't ask for clarification.** Use your judgment. If genuinely blocked, leave a clearly-marked `> TODO:` block in the file and continue.
9. **One commit at the end.** Don't commit incrementally. Build everything, sanity-check, commit once, push once.
10. **No emoji in file content** unless the existing convention uses them (it doesn't, except status ticks like ✅).

---

## Deliverables — Marketing folder (finish what's started)

### 1. `marketing/11-n8n-social-workflow.md`

A complete guide to the n8n workflow that automates SwingBy's social media. Cover:

- **Architecture overview** (Mermaid diagram in mermaid code fence)
- **Nodes required and their purpose:**
  - Cron trigger (daily 9am MT)
  - Content source (Notion DB, Google Sheets, or Airtable — recommend Notion)
  - LLM node (OpenAI/Anthropic) to expand a content brief into platform-specific copy
  - Image generation node (DALL-E or Replicate) — optional
  - Approval gate (Slack/Telegram bot with approve/reject buttons)
  - Platform posters: Instagram (via Meta API), TikTok (via API or Buffer fallback), LinkedIn (via API), Twitter/X (via API), Facebook page (via Meta API)
  - DM auto-reply node (incoming Instagram/Facebook DMs → AI categorize → respond or escalate to founder)
  - Edit/repost flow for post-publish corrections
  - Analytics collector (pull engagement metrics nightly, write back to Notion DB)
- **Workflow setup steps** (numbered, idiot-proof — assume the founder has never used n8n)
- **Required API credentials** with where to get each (and emphasize storing them in n8n credentials, not in the workflow JSON)
- **Cost estimate per month** (n8n cloud or self-hosted, OpenAI tokens, image gen, etc.)
- **Failure modes and fallbacks** (what if Instagram API rate-limits, what if approval times out, etc.)
- **Cross-link to `marketing/07-content-calendar.md`**

### 2. `marketing/workflows/n8n-social-media-workflow.json`

A valid, importable n8n workflow JSON file matching the design above. Use real n8n node types (`n8n-nodes-base.cron`, `n8n-nodes-base.openAi`, `n8n-nodes-base.httpRequest`, etc.). Keep it under ~30 nodes. Include placeholder credential IDs and clear node names. The file must be valid JSON.

### 3. `marketing/workflows/README.md`

A short readme that explains:
- How to import the JSON into n8n (Settings → Import from File)
- Which credentials to set up first
- How to test the workflow before going live
- Where to swap in real Notion DB IDs / Slack channel IDs

### 4. `marketing/11b-ads-plan.md`

Detailed paid-ads playbook (deeper than `06-growth-playbook.md`). Cover:

- **Month-by-month ad budget for year 1** (table)
- **Google Ads campaign structure:** branded, service-intent, brand-comparison — for each: keywords, negative keywords, bid strategy, ad copy variants, landing page
- **Meta Ads campaign structure:** Calgary 25-55 homeowners, lookalike audiences, retargeting — for each: audience definition, creative direction, copy variants
- **TikTok Ads (year 2):** when to consider, target audience, format
- **Reddit Ads (experimental):** which subreddits, format, budget cap
- **Tracking setup:** UTM conventions, conversion events to log in PostHog
- **Kill switches:** specific CAC thresholds at which to pause each campaign
- **Calendar of when to ramp:** week-by-week ramp from $0 to $3k/mo over 12 weeks

### 5. `marketing/11c-customer-acquisition.md`

Deep dive on customer acquisition — both sides of the marketplace. Cover:

- **Business-side acquisition (supply):** outbound scripts, referral mechanics, partnerships, paid ads (cross-link to ads plan)
- **Client-side acquisition (demand):** SEO, paid, social, referral, partnerships
- **The cold-start problem solution:** specific tactics (concierge first 20 bookings, hyperlocal saturation, vertical-first launch)
- **Activation playbook:** first-7-days drip emails, in-app nudges, push notification cadence
- **Reactivation playbook:** for users who signed up but haven't booked, and for completed-once but no repeat
- **Channel benchmark CACs and LTV targets** (pull from `08-kpis-and-metrics.md`)
- **One-page "if I had $10k to spend" answer** at the top

### 6. `marketing/12-social-media-playbook.md`

The day-to-day social media operating manual. Cover:

- **Platform-specific best practices:** Instagram, TikTok, LinkedIn, Twitter/X, Facebook
- **Posting cadence per platform** (from `07-content-calendar.md`, expanded)
- **Hashtag strategy per platform**
- **Engagement playbook:** how to respond to comments, DMs, mentions; when to escalate to founder
- **Crisis management:** what to do when there's a negative review going viral, a service issue, a competitor attack
- **Tools stack:** Canva, CapCut, Buffer, n8n (cross-link to 11)
- **Templates to copy/paste:** 10 caption templates, 5 reply templates, 5 DM templates

### 7. `marketing/MARKETING-PLAN.md`

A single consolidated, investor/partner-shareable marketing plan. This is the "one document I can email to someone" deliverable.

Structure:
- Executive summary (250 words max)
- The market opportunity (Calgary services market, sizing)
- The product (1 paragraph)
- Positioning + competitive landscape (table)
- Monetization model (summary, link to 01)
- Go-to-market plan (summary, link to 03)
- Customer acquisition (summary, link to 11c)
- Growth channels (summary, link to 06)
- Brand + content (summary, links)
- KPIs and milestones (summary, link to 08)
- Partnerships strategy (summary, link to 10)
- 12-month roadmap
- Team + ask (placeholders)

Length target: 2000-3000 words. Should read as a coherent narrative, not a stitched-together index.

---

## Deliverables — privacy-and-security/ folder (build from scratch)

Create the folder and populate with all of the following:

### 8. `privacy-and-security/README.md`

Index of the folder, explaining what's where and how it maps to legal requirements.

### 9. `privacy-and-security/privacy-policy.md`

A real, lawyer-reviewable Privacy Policy for SwingBy. Must cover, at minimum:

- Who we are and how to contact us
- What personal data we collect (categories, with examples from actual app tables: users, businesses, employees, service_posts, bookings, payments, messages, reviews — read `CLAUDE.md` for the schema)
- How we collect it
- Why we collect it / legal basis
- Who we share it with (Supabase, Stripe if used, Resend/SES, Google Maps, Sentry, analytics provider, hosting provider)
- Data retention periods
- User rights under PIPEDA (Canada), GDPR (EU users if applicable), CCPA (CA users if applicable)
- How users exercise those rights (deletion, export, correction)
- Cookies and similar technologies (link to cookie policy)
- Children's privacy (we don't knowingly collect from <16)
- International data transfers
- Security measures (high level — link to security-overview.md)
- Changes to this policy
- Contact for privacy requests: privacy@swingby.ca (placeholder)
- Effective date

Use plain, lawyer-acceptable language. Mark anything truly contested with `> LEGAL REVIEW NEEDED:` blocks for the founder to flag for a lawyer.

### 10. `privacy-and-security/terms-of-service.md`

Full Terms of Service. Cover:

- Acceptance of terms
- Eligibility (must be 18+, business must be legally operating)
- Account creation and security
- Description of service (we are a marketplace, not a party to the service contract — important liability framing)
- User responsibilities (clients and businesses, separately)
- Acceptable use policy
- Payments, escrow, and fees (link to `marketing/02-pricing.md` figures, but rewrite for legal context)
- Cancellation and refund policy
- Reviews and content
- Intellectual property
- Disclaimers
- Limitation of liability
- Indemnification
- Dispute resolution and governing law (Alberta, Canada)
- Termination
- Changes to terms
- Contact: legal@swingby.ca

### 11. `privacy-and-security/cookie-policy.md`

Cookies and tracking technologies policy. Categorize as strictly necessary / functional / analytics / marketing. List actual cookies/storage we use (auth tokens, Supabase session, PostHog/Plausible if used).

### 12. `privacy-and-security/security-overview.md`

Public-facing security overview. Cover:

- Authentication (Supabase Auth, JWT, expiry policy)
- Authorization (RLS on all 10 tables, references `docs/rls_policies.sql`)
- Data encryption (in transit via TLS, at rest via Supabase)
- Payment security (PCI compliance via Stripe — we never touch card data)
- Infrastructure (Supabase on AWS ca-central-1, FastAPI backend on [Render/Fly], mobile via Expo)
- Secrets management (service role key backend-only, env vars never in repo)
- Monitoring (Sentry for errors, structured logging)
- Backup and recovery (Supabase automated backups, RPO/RTO targets)
- Vulnerability disclosure (link to vulnerability-disclosure.md)
- Compliance posture (PIPEDA, working toward SOC 2 — flag as "in progress")

This is public-facing — write for a savvy customer, not a security engineer.

### 13. `privacy-and-security/data-handling.md`

Internal data handling SOP — for the team, not public. Cover:

- Data classification (public, internal, confidential, restricted)
- Per-table classification (which of the 10 tables holds what category)
- Access controls (who on the team can see what)
- Onboarding/offboarding checklist for team members with data access
- Data subject request (DSAR) handling SOP — step by step for handling a user data deletion or export request, with target 30-day SLA per PIPEDA
- Cross-border transfer notes (Supabase ca-central-1, no transfers outside Canada for primary data)
- Logging policy (what we log, what we never log — passwords, full credit card numbers, etc.)
- Retention schedule per data category

### 14. `privacy-and-security/pipeda-compliance.md`

PIPEDA (Personal Information Protection and Electronic Documents Act) compliance checklist for Canadian privacy law. Cover the 10 fair information principles:

1. Accountability
2. Identifying Purposes
3. Consent
4. Limiting Collection
5. Limiting Use, Disclosure, and Retention
6. Accuracy
7. Safeguards
8. Openness
9. Individual Access
10. Challenging Compliance

For each, list (a) what PIPEDA requires, (b) what SwingBy does, (c) what's gap/TODO.

### 15. `privacy-and-security/incident-response.md`

Incident response runbook. Cover:

- Severity definitions (SEV1/SEV2/SEV3/SEV4) with concrete examples
- On-call roles (founder is on-call by default — list backup as TBD)
- Detection (Sentry alerts, user reports, manual)
- Response phases: identify, contain, eradicate, recover, learn
- Communications:
  - Internal Slack template
  - External user-facing template (if a breach affects users)
  - Regulatory notification under PIPEDA (Privacy Commissioner of Canada within "as soon as feasible" — typically 72h)
- Post-incident review template
- Escalation thresholds (when to call a lawyer, when to call a PR firm)

### 16. `privacy-and-security/vulnerability-disclosure.md`

A public-facing responsible disclosure policy for security researchers. Cover:

- Scope (which assets are in scope, which are out)
- How to report (security@swingby.ca placeholder)
- What we commit to (acknowledge within 72h, status update within 7d, fix timeline per severity)
- Safe harbor (we won't pursue legal action against good-faith researchers)
- Hall of fame (when applicable)
- Out-of-scope reports (social engineering, physical, DOS, etc.)

### 17. `privacy-and-security/dpa-template.md`

A Data Processing Agreement template SwingBy can use when onboarding subprocessors (or when a business client demands one). Standard GDPR/PIPEDA-aligned DPA structure. Mark as "template — review with counsel before signing."

### 18. `privacy-and-security/subprocessors.md`

Public list of subprocessors with what data each handles, hosting location, and link to their own privacy policy. Include:

- Supabase (auth, database, storage — ca-central-1)
- Stripe (payment processing — TBD)
- Resend / SES / Postmark (transactional email — TBD)
- Google Maps Platform (geocoding/maps — US)
- Sentry (error monitoring — US/EU)
- Expo (push notifications — US)
- PostHog / Plausible (analytics — TBD)
- Cloudflare (if used for CDN/DDoS — US, edge)

### 19. `privacy-and-security/security-checklist.md`

Internal security checklist — actionable, with checkboxes. Use this as the recurring quarterly audit. Cover:

- Authentication & authorization
- Data protection
- Logging & monitoring
- Backups & recovery
- Secrets & credentials
- Third-party vendors
- Code security (dependency scanning, SAST)
- Infrastructure security
- Incident readiness
- Compliance posture

---

## Final steps (after all files written)

1. Run `git status` to verify what's staged.
2. Run a quick scan: `grep -rE "SUPABASE_SERVICE_KEY|sk_live|sk_test_[a-zA-Z0-9]+|password\s*=\s*['\"]" marketing/ privacy-and-security/` — must be empty.
3. Stage everything: `git add marketing/ privacy-and-security/ .claude/tasks/ .gitignore project-docs/`
4. Verify nothing is staged that shouldn't be: `git diff --cached --stat`
5. Commit:
   ```
   git commit -m "docs: full marketing plan + privacy/security folder

   Marketing folder:
   - n8n social media workflow (doc + importable JSON)
   - Ads plan, customer acquisition deep dive, social media playbook
   - Consolidated MARKETING-PLAN.md for sharing

   Privacy + security folder:
   - Privacy policy, terms of service, cookie policy
   - Security overview, data handling SOP, PIPEDA compliance
   - Incident response runbook, vuln disclosure policy
   - Subprocessor list, DPA template, internal security checklist

   Also moves loose root docs into project-docs/ and gitignores Obsidian vault + seed credentials."
   ```
6. Push: `git push origin main`
7. Print a summary of what was built, total file count, total word count (approximate).

---

## Success criteria

- All 19 deliverables exist and are non-trivial (each marketing doc >800 words, each privacy doc >500 words except short ones like subprocessors).
- No secrets in any file.
- `git status` is clean after push.
- `git log -1` shows the new commit on origin/main.
- Voice and structure consistent with existing `marketing/01-10` files.
- Cross-links between docs are real and resolve.

---

## If something blocks you

Leave a clearly-marked block in the file:

```
> TODO (HUMAN): [specific question or missing info]
```

Then continue with the rest. Do not stop the run. The founder will sweep TODOs at the end.

---

## Go

Read `CLAUDE.md` and `marketing/01-monetization-strategy.md` to anchor on voice. Then start with deliverable #1 and work sequentially to #19. Commit and push at the end.
