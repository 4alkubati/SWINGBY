# Phase 2 Brief — Wire Real Credentials + Test Every Connection

You are operating autonomously in bypass-permissions mode. This brief assumes Phase 1 ran successfully and the user has now filled in `.claude/secrets/social-credentials.txt` with real values.

Your job: read those credentials, create the matching credential records in n8n, rewire the placeholder credential IDs in the three workflows to point at the real ones, then test every connection and report a green/red status for each.

---

## Required context

1. `.claude/secrets/social-credentials.txt` — the file the user filled in (gitignored, present only on their machine).
2. `marketing/workflows/n8n-social-media-workflow.json`, `n8n-engagement-collector.json`, `n8n-dm-auto-reply.json` — the three workflows from Phase 1.
3. `marketing/11-n8n-social-workflow.md` — the design doc.

---

## MCP servers required

- **n8n MCP** — already configured. Must be connected for this brief.

**If n8n MCP not connected:** stop and print the config snippet for the user, then exit.

---

## Critical security rules

1. **NEVER write credentials to disk in plaintext outside `.claude/secrets/social-credentials.txt`.** That file is gitignored.
2. **NEVER include credentials in commit messages, logs, or summary output.** Replace all values with `***` when echoing back.
3. **NEVER commit `.claude/secrets/social-credentials.txt`.** If `git status` shows it, hard stop and tell the user.
4. **NEVER print full tokens** in the SUMMARY block. Print only `last4` or `present/absent`.

---

## Workflow

### Step 1 — Read and parse credentials

Parse `.claude/secrets/social-credentials.txt` into a key-value map. Skip lines starting with `#` and empty values.

If the file does not exist: stop and tell the user to copy the template:
```
cp .claude/secrets/social-credentials.template.txt .claude/secrets/social-credentials.txt
```

### Step 2 — Validate each credential's format

For each non-empty credential, do a cheap format check (length, prefix, regex). Categorize:
- ✅ Present + plausible format
- ⚠️ Present but suspect format
- ⛔ Empty

### Step 3 — Create n8n credential records

For each present credential, use the n8n MCP `create_credential` (or equivalent) to create a matching credential record. Naming convention: `swingby-<provider>-<purpose>` so they match the placeholder IDs used in Phase 1.

| Provider | n8n credential type | Source keys |
|---|---|---|
| Notion | `notionApi` | `NOTION_INTEGRATION_TOKEN` |
| OpenAI | `openAiApi` | `OPENAI_API_KEY` |
| Slack | `slackApi` | `SLACK_BOT_TOKEN` |
| Meta / Instagram / Facebook | `facebookGraphApi` | `META_PAGE_ACCESS_TOKEN` |
| Twitter / X | `twitterOAuth2Api` or `twitterApi` | the 5 Twitter keys |
| LinkedIn | `linkedInOAuth2Api` | `LINKEDIN_ACCESS_TOKEN` + `LINKEDIN_ORGANIZATION_URN` |
| TikTok | `httpHeaderAuth` (custom — TikTok lacks a 1st-party n8n node) | `TIKTOK_ACCESS_TOKEN` |
| Cloudflare R2 | `s3` (S3-compatible) | 4 R2 keys |
| Resend (optional) | `httpHeaderAuth` | `RESEND_API_KEY` |

For TikTok and Resend, the credential type is generic HTTP auth — set `Authorization: Bearer <token>` in the credential.

### Step 4 — Rewire workflows

For each of the three workflows, walk the node list and replace placeholder credential IDs (`swingby-meta-cred`, etc.) with the real IDs the MCP returned in Step 3. Save updated workflows back via the MCP.

Also replace any `{{$env.NOTION_CONTENT_DB_ID}}` style variables with the real Notion DB IDs from the credentials file.

### Step 5 — Test each connection

Run one cheap test per integration. **Do not actually post anything.**

| Provider | Test |
|---|---|
| Notion | List databases the integration has access to → confirm content + metrics DBs are visible |
| OpenAI | Send a 5-token "ping" prompt → confirm 200 response |
| Slack | Post a single message to `SLACK_ALERTS_CHANNEL_ID` saying `"SwingBy n8n setup test - <timestamp>"` |
| Meta | Call `me?fields=id,name` on the Instagram Business Account ID → confirm 200 |
| Twitter | Call `users/me` v2 endpoint → confirm 200 |
| LinkedIn | Call `userinfo` endpoint → confirm 200 |
| TikTok | Call `user/info/` endpoint → confirm 200 |
| R2 | Upload a 1KB test file `swingby-r2-test.txt` then delete it → confirm 200 on both |
| Resend (if present) | Call `domains` endpoint → confirm 200 |

For each test, record:
- HTTP status
- Latency
- Error message (if any)

### Step 6 — Activate the workflows

If all required credentials passed:
- Set each workflow to `active: true` via the MCP.
- Tell the user: "All three workflows are now LIVE. The next 9am MT cron will fire."

If any required credential failed:
- Leave workflows **inactive**.
- Print the failures clearly.

### Step 7 — Print SUMMARY

```
PHASE 2 SUMMARY
===============
Credentials file: .claude/secrets/social-credentials.txt
Total keys read: <N>
Filled in: <N>
Empty: <N>

Credential validation:
  Notion: <PASS|FAIL> — <error if any>
  OpenAI: <PASS|FAIL>
  Slack: <PASS|FAIL>
  Meta: <PASS|FAIL>
  Twitter: <PASS|FAIL>
  LinkedIn: <PASS|FAIL>
  TikTok: <PASS|FAIL>
  R2: <PASS|FAIL>
  Resend: <PASS|FAIL|SKIPPED>

n8n credentials created: <N>
n8n workflows rewired: 3
n8n workflows activated: <N>/3

Status: GREEN (everything live) | YELLOW (some integrations skipped, rest live) | RED (blocked)

Next:
- Watch the 9am MT cron fire
- Confirm the first Slack approval message lands in <channel>
- If anything fails in the first run, check Sentry / Slack alerts / n8n execution log
```

**Never include actual tokens or secrets in this summary.**

---

## If you're blocked

Print the blocker and stop. Do not guess at credentials, do not push partial state.

## Go.

Read `.claude/secrets/social-credentials.txt`. If it doesn't exist, exit with instructions. Otherwise, proceed through steps 1–7.
