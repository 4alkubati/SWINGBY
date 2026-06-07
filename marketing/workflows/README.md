# SwingBy n8n Workflows

This folder contains importable n8n workflow files for SwingBy's social media automation.

---

## Workflows

| File | Purpose |
|---|---|
| `n8n-social-media-workflow.json` | Daily posting, DM routing, and nightly analytics |

Full documentation: [`marketing/11-n8n-social-workflow.md`](../11-n8n-social-workflow.md)

---

## How to import into n8n

1. Open your n8n instance (self-hosted or cloud.n8n.io).
2. Click **Workflows** in the left sidebar.
3. Click **Import from File** (top-right menu or the "+" button → Import).
4. Select `n8n-social-media-workflow.json`.
5. The workflow will appear in your workspace. It is **inactive** by default — do not activate until credentials are set up.

---

## Credentials to set up first

Set these up under **Settings → Credentials** in n8n before activating any node.

| Credential name | Type | Where to get it |
|---|---|---|
| `Notion API` | Notion API | developers.notion.com → New integration → copy token |
| `OpenAI API Key` | OpenAI | platform.openai.com → API Keys |
| `Slack Bot Token` | Slack API (Bot) | api.slack.com/apps → OAuth & Permissions → Bot Token |
| `Twitter OAuth2` | Twitter OAuth2 | developer.twitter.com → App → Keys and Tokens |
| `LinkedIn OAuth2` | LinkedIn OAuth2 | developer.linkedin.com → App |
| `Buffer API` (optional) | HTTP Header Auth | buffer.com/developers → Access Token |

---

## Variables to configure

After importing, open the workflow and update these values. They appear as `={{$vars.VARIABLE_NAME}}` in node parameters.

| Variable | Where to set | Value |
|---|---|---|
| `NOTION_CONTENT_DB_ID` | n8n Variables (Settings → Variables) | 32-char hex ID from your Notion DB URL |
| `INSTAGRAM_USER_ID` | n8n Variables | From Meta Graph API Explorer: `GET /me?fields=id` with your IG token |
| `FACEBOOK_PAGE_ID` | n8n Variables | From Facebook Page → About → Page ID |
| `META_ACCESS_TOKEN` | n8n Variables | Long-lived Page Access Token from developers.facebook.com |
| `LINKEDIN_ORG_ID` | n8n Variables | From your LinkedIn Company Page URL (the number) |
| `BUFFER_TIKTOK_PROFILE_ID` | n8n Variables | From Buffer API: `GET /profiles` |
| `SLACK_APPROVAL_CHANNEL` | n8n Variables | Slack channel ID (right-click channel → Copy Link → last segment) |
| `SLACK_METRICS_CHANNEL` | n8n Variables | Slack channel ID |
| `SLACK_ALERTS_CHANNEL` | n8n Variables | Slack channel ID |

To set n8n Variables: go to **Settings → Variables → Add Variable**.

---

## How to test before going live

1. Set up all credentials and variables above.
2. In the Notion DB, create a test row:
   - Title: "Test post"
   - Status: ready
   - Scheduled date: today
   - Content brief: "A test post to verify the workflow"
3. Open the workflow in n8n. Click **Execute Workflow** (manual trigger button next to "Daily 9am Trigger").
4. Watch each node execute in sequence.
5. Verify the Slack approval message arrives in `#content-approvals`.
6. Approve the post via Slack.
7. Confirm posts appear on Instagram, Facebook, Twitter, and LinkedIn.
8. Check the Notion row is updated to Status = "posted" with post IDs.

If any node fails, click it to see the error detail. The most common issues:
- Token expired (Meta tokens expire every 60 days — refresh at developers.facebook.com)
- Wrong credential selected (open the node, check the credential dropdown)
- Variable not set (Settings → Variables → confirm the value exists)

---

## Activating the workflow

Once testing passes:
1. Click the toggle at the top of the workflow to activate it.
2. The cron trigger will fire every day at 9am Mountain Time.
3. Do not run the manual trigger again — it will double-post.

---

## Maintaining the workflow

| Task | Frequency |
|---|---|
| Refresh Meta Page Access Token | Every 55 days (set a calendar reminder) |
| Refresh LinkedIn Access Token | Every 55 days |
| Review OpenAI costs | Monthly (check platform.openai.com) |
| Check n8n execution log for errors | Weekly |
| Update Notion DB ID if DB changes | As needed |
