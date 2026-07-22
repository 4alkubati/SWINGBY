---
group: market
project: swingby
hub: "[[MOC-Market]]"
tags: [market]
---
# Notion Database Schemas — SwingBy Social Automation

Two Notion databases power the n8n workflows. Create them manually before running the Phase 2 setup checklist in `marketing/11-n8n-social-workflow.md`.

---

## Database 1 — SwingBy Content Queue

This is the editorial calendar. The founder adds one row per piece of content. The daily publishing workflow reads rows where Status=ready and Scheduled date=today.

### Properties

| Property name | Type | Notes |
|---|---|---|
| Title | Title | The post idea or headline. Be specific — the AI uses this to anchor the caption. |
| Brief | Rich text | 1–2 sentences describing what the post says. The more specific, the better the AI output. Example: "The story of how Maria found a house cleaner in 9 minutes using SwingBy — her words, not ours." |
| Pillar | Select | One of the five content pillars (see options below) |
| Status | Select | Controls workflow: only `ready` rows are picked up. See status flow below. |
| Scheduled date | Date | The day this post should go out. Set to any weekday. |
| Platforms | Multi-select | Which platforms to publish to. Leave all selected unless you want to skip one. |
| Image style | Select | Guides the visual. `photo` = real photography, `illustration` = AI-generated, `none` = text-only post |
| Caption draft | Rich text | Optional. If you write the caption yourself, paste it here and the AI will use it as-is. Leave blank for AI generation. |
| Image URL | URL | Optional. Link to a pre-made Canva image, Unsplash photo, or CDN-hosted image. Leave blank if you want the workflow to use a placeholder. |
| Post URLs | Rich text | Auto-filled by the workflow after publishing. Format: `IG:{id} FB:{id} TW:{id} LI:{id}` |
| Posted at | Date | Auto-filled by the workflow with the timestamp of when posting completed. |
| Approval Slack thread | URL | Optional. Paste the Slack message link from the approval message for easy reference. |

### Pillar options (Select)

- Customer wins
- Founder POV
- Behind-the-business
- Education
- Calgary spotlight

### Status options (Select) — in order of workflow lifecycle

| Status | Set by | Meaning |
|---|---|---|
| `ready` | Founder | Ready to post on the scheduled date |
| `awaiting_approval` | (reserved) | Not currently used by workflow, but available for manual use |
| `approved` | (reserved) | Not currently used by workflow |
| `posted` | Workflow | Successfully posted to all platforms |
| `rejected` | Workflow | Rejected via Slack approval gate |
| `failed` | Manual | Manually mark if a post partially failed and needs attention |

### Platform options (Multi-select)

- instagram
- tiktok
- linkedin
- twitter
- facebook

### Image style options (Select)

- photo
- illustration
- none

---

## Database 2 — SwingBy Post Metrics

The engagement collector writes one row here every night with the day's aggregate metrics across all platforms. Use this to track trends and identify your best content.

### Properties

| Property name | Type | Notes |
|---|---|---|
| Title | Title | Auto-filled: `Daily Metrics — Month D, YYYY` |
| Report date | Date | Auto-filled: the date the metrics were collected |
| IG Likes | Number | Total likes on recent IG posts |
| IG Comments | Number | Total comments on recent IG posts |
| FB Likes | Number | Total likes on recent FB page posts |
| Twitter Likes | Number | Total likes on recent tweets |
| Twitter Impressions | Number | Total impressions on recent tweets |
| LinkedIn Impressions | Number | Total impressions on LinkedIn posts |
| LinkedIn Likes | Number | Total likes on LinkedIn posts |
| Notes | Rich text | Manual notes — e.g., "launched referral campaign this week" |

### Formula properties (add these manually after creating the DB)

These are optional but useful for weekly reviews:

| Property name | Formula | Purpose |
|---|---|---|
| Total engagement | `prop("IG Likes") + prop("IG Comments") + prop("FB Likes") + prop("Twitter Likes") + prop("LinkedIn Likes")` | Cross-platform engagement total |
| Best platform | (use a formula plugin or manual select) | Track which platform drives the most likes |

---

## How to set up these databases

### Step 1 — Create the Content Queue database

1. Open Notion. Create a new page (or add inside your SwingBy workspace).
2. Type `/database` and select **Database — Full page**.
3. Name it exactly: `SwingBy Content Queue`.
4. Add each property from the table above:
   - Click `+` at the top right of the table to add a column.
   - Select the type from the dropdown (Title is already there).
   - For Select/Multi-select: add each option exactly as spelled above (case-sensitive — the workflow matches these strings).
5. Create one test row:
   - Title: `Test post — house cleaning`
   - Brief: `SwingBy makes finding a house cleaner simple. Post a job, get offers in minutes.`
   - Pillar: `Education`
   - Status: `ready`
   - Scheduled date: today's date
   - Platforms: `instagram`, `linkedin`, `twitter`, `facebook`, `tiktok`
   - Image style: `none`

### Step 2 — Create the Post Metrics database

1. Create another full-page database.
2. Name it exactly: `SwingBy Post Metrics`.
3. Add each property from the table above.
4. Leave it empty — the workflow fills it nightly.

### Step 3 — Create a Notion integration

1. Go to [developers.notion.com](https://developers.notion.com) → **My integrations** → **New integration**.
2. Name: `SwingBy n8n`
3. Type: Internal integration
4. Capabilities: Read content, Update content, Insert content (all three)
5. Copy the **Internal Integration Token** (starts with `secret_`).

### Step 4 — Share databases with the integration

For each database:
1. Open the database in Notion.
2. Click `...` (top right) → **Connections** → search for `SwingBy n8n` → click to connect.

### Step 5 — Copy database IDs

1. Open the Content Queue database in your browser.
2. The URL looks like: `https://www.notion.so/{workspace}/{32-char-hex}?v=...`
3. Copy the 32-char hex string (the database ID).
4. Repeat for the Post Metrics database.

### Step 6 — Add to n8n and to secrets file

In n8n:
- Settings → Variables → Add variable `NOTION_CONTENT_DB_ID` = (content queue ID)
- Settings → Variables → Add variable `NOTION_METRICS_DB_ID` = (post metrics ID)
- Credentials → Add `swingby-notion-cred` → Notion API → paste the integration token

In your secrets file:
- Open `.claude/secrets/social-credentials.txt`
- Fill in the `NOTION_CONTENT_DB_ID`, `NOTION_METRICS_DB_ID`, and `NOTION_INTEGRATION_TOKEN` fields

---

## Verifying the setup works

Once credentials are in place:

1. Make sure the test row in Content Queue has Status=`ready` and Scheduled date=today.
2. In n8n → open "SwingBy — Daily social publishing" → click **Test workflow**.
3. The Notion node should return your test row.
4. The agent node should generate 5 platform captions.
5. A Slack approval message should arrive in `#swingby-approvals`.
6. Click **Approve**.
7. The workflow should attempt to post to each platform and update the Notion row to Status=`posted`.

If any platform post fails (expected before credentials are wired), the error shows in n8n's execution log. The workflow continues to the next platform regardless — one failure doesn't block the others.

<!-- graph-wire:start -->
---
**Up:** [[MOC-Market]] · **Home:** [[SWINGBY]]
<!-- graph-wire:end -->
