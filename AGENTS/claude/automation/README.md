# automation — local n8n (Docker)

## Stack (live since 2026-07-14)

- **`docker-compose.yml`** — runs n8n as container `swingby-n8n` on http://localhost:5678 (owner login in `credentials/api-keys/n8n.md`). Repo mounted read-only at `/data/swingby`; Telegram secrets injected from `.claude/secrets/n8n.env`.
- **`morning_brief.workflow.json`** — imported AND active (id `MorningBriefSwing`). Re-import after editing:
  `docker exec swingby-n8n n8n import:workflow --input=/data/swingby/AGENTS/claude/automation/morning_brief.workflow.json && docker restart swingby-n8n`
- **`send-test-brief.sh`** — fires the brief right now (delivery test without waiting for morning).
- **`run-overnight.sh`** — the overnight build loop (`claude -p` on LOOP.md, auto-resumes after usage-limit resets). Works the 🌙 Tonight queue in `memory/PLAN.md`.

## Morning Brief — node by node (4-message format since 2026-07-15)

1. **Schedule 06:05** — cron `5 6 * * *`, fires 06:05 America/Edmonton (container `GENERIC_TIMEZONE`).
2. **Compile Brief** (Code node, `fs` allowed) — reads `memory/STATUS.md`, `memory/HUMAN-TODO.md` (🌅 This-morning + ⛔ Blocking checkboxes), `memory/SESSION_LOG.md` (last NEXT line), and the tail of `automation/overnight.log`. **Sanitises everything** before sending: strips all Markdown/Obsidian noise (`**bold**`, `` `code` ``, `###`, `[[wikilinks]]`, `- [ ]`, `·` → `—`) AND leading `(Bucket X — …)`-style jargon tags, clips each line on a word/sentence boundary (never mid-word), and formats as clean `•` bullets under bold section headers (Telegram HTML — see node 3). **KIRA.md voice pass (2026-07-17,** per `~/brain/KIRA.md`**):** message 3 leads with a **Decide today** block (any task matching /decision|decide|your call/), tasks carry up to 3 numbered sub-steps (multi-line checkboxes no longer end mid-sentence), checked-off items are skipped entirely, and the log tail never shows raw stack-trace lines. Emits **4 items → 4 Telegram messages**:
   - **1/4 ☀️ header + 🔧 BACKEND** — SIGNAL line + backend bullets
   - **2/4 📱 FRONTEND / MOBILE** — mobile bullets
   - **3/4 🧑 HUMAN TODO** — this-morning + blocking checkboxes + Next Actions
   - **4/4 🌙 NIGHT RECAP** — mixed/other bullets **reduced to headlines** (text before the first `:`, ≤60 chars — detail stays in STATUS.md), loop log tail, LOOP NEXT
   Splitting: if STATUS.md has a `## Morning Brief` section with `### Backend` / `### Frontend` / `### Recap` subsections, those are used verbatim (preferred — orchestrator can write it at session end). Otherwise the Session End Signal bullets are bucketed by keyword; bullets matching both/neither go to the recap.
3. **Telegram — Send Brief** (HTTP node) — one `sendMessage` per item, 800 ms apart so order holds, `parse_mode: HTML` (bold headers render; the Compile node HTML-escapes all dynamic text). Token per item: `$env[item.tokenVar] || $env.TELEGRAM_BOT_TOKEN`.

## Secrets

`.claude/secrets/n8n.env` (gitignored; template committed next to it):
```
TELEGRAM_BOT_TOKEN=   ← @BotFather (the pre-2026-07 token leaked — use a fresh bot)
TELEGRAM_CHAT_ID=     ← @userinfobot
# OPTIONAL — one bot per brief section ("team channel" look). Any that are unset
# fall back to TELEGRAM_BOT_TOKEN. Create via @BotFather (/newbot), then either
# /start each bot in DM, or add all bots to one group and point TELEGRAM_CHAT_ID
# at the group id (negative number).
TELEGRAM_BOT_TOKEN_BACKEND=
TELEGRAM_BOT_TOKEN_FRONTEND=
TELEGRAM_BOT_TOKEN_HUMAN=
TELEGRAM_BOT_TOKEN_NIGHT=
```
After editing: `docker compose -f AGENTS/claude/automation/docker-compose.yml up -d --force-recreate`, then `bash AGENTS/claude/automation/send-test-brief.sh` to verify.

**Telegram platform limit worth knowing:** bots can never see other bots' messages, so "bots talking to each other" in a group is impossible on Telegram — the multi-bot setup is presentation only (each section gets its own name/avatar). Any actual agent-to-agent coordination stays in n8n/the repo.

## Deferred (unchanged)

Gmail inbox + social analytics branches were dropped from the workflow until their credentials exist (Gmail OAuth = the Google Cloud rabbit hole per GEN-1 Step 10). Add them back as parallel branches into Compile Brief when ready.
