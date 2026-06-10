# Phase 1 Brief — Build the n8n Social Workflow + Extend Marketing Plans

You are operating autonomously on the SwingBy project in bypass-permissions mode. This brief covers two independent workstreams. Do them both end-to-end. **You will not have access to real social-media credentials in this phase** — that is intentional. Phase 2 (separate run) wires credentials in later. Your job here is to design, build, and document the workflow + extend the marketing materials.

---

## Required context — read first

1. `CLAUDE.md` (project root) — master context, schema, voice rules.
2. `marketing/01-monetization-strategy.md` through `marketing/12-social-media-playbook.md` — established marketing strategy, voice, and the existing n8n design doc (`11-n8n-social-workflow.md`).
3. `marketing/workflows/n8n-social-media-workflow.json` — the existing workflow JSON. You may rebuild it.
4. `marketing/MARKETING-PLAN.md` — the consolidated investor-ready plan.

---

## MCP servers required

This brief assumes two MCP servers are connected to your CLI session:

- **n8n MCP** — for inspecting and building n8n workflows. Standard packages: `@czlonkowski/n8n-mcp` or `n8n-mcp-server`. Configured via `.mcp.json` or your Claude Code MCP config with `N8N_API_URL` and `N8N_API_KEY` env vars (these can come from `.claude/secrets/social-credentials.txt` if present, or you can ask the user).
- **Supabase MCP** — already connected (project id `ulnxapnsenzyddddldjt`). Used to write back any analytics schema if needed.

**If the n8n MCP is not connected:** stop, print the exact config snippet the user needs to paste into `.mcp.json`, and exit gracefully. Example config:

```json
{
  "mcpServers": {
    "n8n": {
      "command": "npx",
      "args": ["-y", "@czlonkowski/n8n-mcp"],
      "env": {
        "N8N_API_URL": "http://localhost:5678",
        "N8N_API_KEY": "<paste from .claude/secrets/social-credentials.txt>"
      }
    }
  }
}
```

Do NOT proceed without the n8n MCP. Building the workflow JSON by hand is also acceptable as a fallback if the MCP is unavailable — write the JSON file directly to `marketing/workflows/`.

---

## Constraints — non-negotiable

1. **No live credentials in this phase.** Every credential reference in the workflow is a *placeholder credential ID* like `swingby-meta-cred`, `swingby-openai-cred`, etc. Phase 2 will create the real credentials in n8n and rewire the workflow.
2. **No secrets in committed files.** Never commit a `.env`, never commit `.claude/secrets/*.txt` (only `*.template.txt`).
3. **Voice consistency** with `marketing/09-brand-guidelines.md` — direct, warm, plain. No "revolutionary," "unlock," "leverage."
4. **Real implementations, not stubs.** Every template, every workflow node, every doc must be production-quality.
5. **Markdown only** for docs. Workflows are JSON.

---

## Workstream 1 — Build the full n8n social workflow

### 1.1 — Design the workflow architecture

Read the existing design in `marketing/11-n8n-social-workflow.md`. Verify it covers:

- Cron trigger (daily 9am Mountain Time)
- Notion content-brief pull (today's queue, status="ready")
- Per-brief loop:
  - GPT call → expand brief into platform-specific captions (IG, TikTok, LI, Twitter, FB)
  - Image generation (DALL-E or Replicate) → download → upload to R2 → get public URL
  - Slack approval message with Approve/Reject buttons + 4-hour auto-approve fallback
  - Conditional fork: if approved → post to each platform; if rejected → write back to Notion as rejected
- Per-platform poster (5 platforms): IG, TikTok, LI, Twitter, FB Page
- Error capture → Slack alerts channel
- Nightly engagement collector (separate workflow): pulls metrics from each platform 24h after post, writes back to Notion metrics DB
- DM auto-reply (separate workflow): Meta webhook → GPT classifier → either auto-respond or escalate to Slack

If the design doc misses any of the above, update the doc first. Then build the workflow.

### 1.2 — Build the workflow programmatically via n8n MCP

For each of three workflows below, use the n8n MCP `create_workflow` (or equivalent) to build them in the connected n8n instance. Use placeholder credential IDs everywhere. After creating each, export the JSON via the MCP `get_workflow_json` (or equivalent) and save to `marketing/workflows/`.

Three workflows to create:

| File | Workflow name | Trigger | Purpose |
|---|---|---|---|
| `marketing/workflows/n8n-social-media-workflow.json` | "SwingBy — Daily social publishing" | Cron 09:00 MT | Pull briefs, expand, approve, post |
| `marketing/workflows/n8n-engagement-collector.json` | "SwingBy — Engagement collector" | Cron 23:00 MT | Pull yesterday's metrics, write back to Notion |
| `marketing/workflows/n8n-dm-auto-reply.json` | "SwingBy — DM auto-reply" | Webhook | Classify + respond or escalate |

For each workflow:
- Use a unique workflow ID that doesn't collide with existing.
- Tag each workflow with `swingby` + `social` so they group in the n8n UI.
- Keep node count tight: <40 nodes per workflow, named clearly (`Pull briefs`, `Expand for IG`, etc.).
- Add a "Sticky Note" node at the top of each workflow explaining what it does and where to find the docs.

### 1.3 — Workflow design checklist

For each workflow, confirm:
- [ ] Cron / webhook trigger is correct (Mountain Time = `America/Edmonton`).
- [ ] All credentials are placeholders (look like `swingby-<provider>-cred` strings).
- [ ] Every HTTP request node has timeout = 30s and 2 retry attempts on 5xx.
- [ ] Every external API call is wrapped in a try/catch error route → Slack alerts channel.
- [ ] No hard-coded URLs to dev/staging — use n8n variables `{{$env.WEBHOOK_BASE}}` etc. where applicable.
- [ ] Each branch end-point writes status back to Notion ("posted", "failed", "rejected", "awaiting_approval").

### 1.4 — Document the workflow

Update `marketing/11-n8n-social-workflow.md` to reflect the *as-built* design. Include:

- A Mermaid diagram per workflow (in mermaid fences) showing actual node flow.
- A node-by-node table: node name, type, purpose, required credentials.
- A "first-time setup" checklist for the operator (founder) — what to fill into each credential.
- A "weekly operator routine" — what to check in n8n + Notion every Monday.
- A cost estimate per month at 30 posts/wk (n8n cloud or self-hosted, OpenAI tokens at ~3k tokens/post, image gen at $0.04/image).

### 1.5 — Build the Notion schema (read-only spec — Phase 2 will create the actual DBs)

Write `marketing/workflows/notion-schema.md` documenting two Notion databases the user needs to create:

**Database 1 — `SwingBy Content Queue`** with properties:
- Title (text)
- Brief (rich text) — 1-2 sentences the founder writes
- Pillar (select: Customer wins | Founder POV | Behind-the-business | Education | Calgary spotlight)
- Status (select: ready | awaiting_approval | approved | posted | rejected | failed)
- Scheduled date (date)
- Platforms (multi-select: instagram | tiktok | linkedin | twitter | facebook)
- Image style (select: photo | illustration | none)
- Post URLs (rich text — filled by the workflow after posting)
- Posted at (date — filled by workflow)
- Approval Slack thread (URL — filled by workflow)

**Database 2 — `SwingBy Post Metrics`** with properties:
- Title (text) — auto-filled from content
- Platform (select)
- Post URL (URL)
- Posted at (date)
- Impressions (number)
- Likes (number)
- Comments (number)
- Shares (number)
- Saves (number)
- Engagement rate (formula: (likes+comments+shares+saves)/impressions)
- Last collected at (date)

Include a "How to set up these databases" section: open Notion, create DB, add properties, share with the integration, copy the DB ID, paste into `.claude/secrets/social-credentials.txt`.

---

## Workstream 2 — Extend marketing plans

The existing `marketing/` folder has structure and strategy. Extend with the concrete artifacts the founder needs to actually execute.

### 2.1 — Concrete content draft library

Create `marketing/content-library/` with the following:

| File | Contents |
|---|---|
| `instagram-90-day-drafts.md` | 90 ready-to-post captions for IG, organized by week and content pillar. Each draft: hook line, body, CTA, 5–10 hashtags. Use the brand voice from `marketing/09-brand-guidelines.md`. Pull themes from `marketing/07-content-calendar.md`. |
| `tiktok-30-day-scripts.md` | 30 short-video scripts. Each: 15–30s, hook in first 3 seconds, 3-beat narrative, on-screen captions cue, CTA. Topics: customer wins, before/after, founder POV, "POV: you found a cleaner in 60 seconds." |
| `linkedin-30-day-posts.md` | 30 LinkedIn posts (founder personal + company), focused on Calgary tech, marketplace dynamics, build-in-public. Each: hook, 2–3 paragraphs, line breaks for readability, single CTA. |
| `twitter-90-day-threads.md` | 30 Twitter/X threads + 60 single tweets. Threads: marketplace dynamics, build-in-public progress, Calgary spotlights. Singles: filler + replies. |
| `email-drips.md` | 5 full drip campaigns: (1) Welcome new client, (2) Welcome new business, (3) Reactivate inactive client, (4) Onboard newly-verified business, (5) Quarterly recap to all users. Each drip has 5 emails with subject + body. |

### 2.2 — Campaign briefs

Create `marketing/campaigns/` with:

| File | Contents |
|---|---|
| `launch-week-brief.md` | The full launch week plan: day-by-day, channel-by-channel, who does what, with go/no-go gates. |
| `referral-program-brief.md` | Detailed mechanics for the two-sided referral loop ($50 biz↔biz, $10 client↔client). Includes in-app copy, email copy, dashboard wireframes (text-described), tracking events. |
| `hyperlocal-seo-brief.md` | The 50-page hyperlocal SEO build plan with: target keyword list (5 categories × 10 neighbourhoods), page template, internal linking structure, schema.org JSON-LD spec, projected traffic ramp, monthly content-add cadence. |
| `influencer-outreach-brief.md` | Outreach mechanics: how to find Calgary micro-influencers, the pitch DM template, the gift/comp matrix, the contract terms, the brief-to-creator template, the post-campaign report template. |

### 2.3 — Paid-ads creative drafts

Create `marketing/ads/`:

| File | Contents |
|---|---|
| `google-ads-copy.md` | 30 Google Ads variants: 10 branded, 10 service-intent, 10 brand-comparison. Each: 3 headlines (30 char), 2 descriptions (90 char), final URL pattern, expected CTR. |
| `meta-ads-creative-direction.md` | 15 Meta Ads concepts (Reels-style, image-only carousel, single image). Each: target audience, hook, visual direction (described, not designed), primary text, headline, CTA button, landing page URL. |
| `landing-pages.md` | URL patterns + page-copy briefs for the 10 most important paid-ads landing pages (e.g. `/calgary/cleaners-near-me`, `/calgary/handyman`, `/post-a-job`). |

### 2.4 — Operational templates

Create `marketing/templates/`:

| File | Contents |
|---|---|
| `cold-email-templates.md` | 10 cold email variants for business outreach. Founder-to-founder, founder-to-trade, founder-to-association. Subject lines + bodies. |
| `press-pitch-template.md` | 1-page pitch to local Calgary press (Herald, BetaKit, CTV) with subject line variants and the full pitch body. Includes a 100-word boilerplate "About SwingBy." |
| `partner-pitch-templates.md` | 5 partnership pitches (Chamber, SAIT, City of Calgary, trade associations, QuickBooks/Wave). |
| `customer-story-template.md` | A template for capturing and publishing customer success stories (interview Qs, photo brief, post structure). |
| `weekly-marketing-standup-template.md` | A 5-section weekly review template: WATB, growth experiments run, content shipped, channel performance, next week priorities. |

---

## Final steps

1. **Secret scan:**
   ```
   grep -rE "(sk_live|sk_test_[a-zA-Z0-9_]{20,}|EAACEdEose|AKIA[0-9A-Z]{16}|password\s*=\s*['\"][^'\"]+)" marketing/ .claude/ 2>/dev/null
   ```
   Must be empty.

2. **Commit per workstream:**
   - `feat(n8n): build daily social publishing + engagement collector + DM auto-reply workflows`
   - `feat(marketing): content libraries, campaign briefs, ads copy, operational templates`

3. **Push both:** `git push origin main`

---

## Reporting back

Print this exact block at the end:

```
PHASE 1 SUMMARY
===============
n8n MCP connected: YES | NO
Workflows created: <N> (list names + IDs)
Workflow JSON files: <count> in marketing/workflows/
Marketing files created: <count>
Total words written: ~<N>k
TODOs blocking Phase 2: <list>

Next: user creates the Notion databases per marketing/workflows/notion-schema.md, fills .claude/secrets/social-credentials.txt, and runs the Phase 2 brief.
```

---

## If you're blocked

Leave a `> TODO (HUMAN): <what you need>` block and continue. Never stop the run waiting.

## Go.

Read `CLAUDE.md`, then `marketing/11-n8n-social-workflow.md`, then verify n8n MCP connection, then start Workstream 1.
