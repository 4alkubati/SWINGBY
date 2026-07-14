# automation — local n8n (Docker)

## Stack (live since 2026-07-14)

- **`docker-compose.yml`** — runs n8n as container `swingby-n8n` on http://localhost:5678 (owner login in `credentials/api-keys/n8n.md`). Repo mounted read-only at `/data/swingby`; Telegram secrets injected from `.claude/secrets/n8n.env`.
- **`morning_brief.workflow.json`** — imported AND active (id `MorningBriefSwing`). Re-import after editing:
  `docker exec swingby-n8n n8n import:workflow --input=/data/swingby/AGENTS/claude/automation/morning_brief.workflow.json && docker restart swingby-n8n`
- **`send-test-brief.sh`** — fires the brief right now (delivery test without waiting for morning).
- **`run-overnight.sh`** — the overnight build loop (`claude -p` on LOOP.md, auto-resumes after usage-limit resets). Works the 🌙 Tonight queue in `memory/PLAN.md`.

## Morning Brief — node by node

1. **Schedule 06:05** — cron `5 6 * * *`, fires 06:05 America/Edmonton (container `GENERIC_TIMEZONE`).
2. **Compile Brief** (Code node, `fs` allowed) — reads `memory/STATUS.md` (Session End Signal + Next Action), `memory/HUMAN-TODO.md` (⛔ Blocking items), `memory/SESSION_LOG.md` (last NEXT line), and the tail of `automation/overnight.log`.
3. **Telegram — Send Brief** (HTTP node) — POSTs to the Bot API using `$env.TELEGRAM_BOT_TOKEN` / `$env.TELEGRAM_CHAT_ID` from the container env. No n8n credential store involved.

## Secrets

`.claude/secrets/n8n.env` (gitignored; template committed next to it):
```
TELEGRAM_BOT_TOKEN=   ← @BotFather (the pre-2026-07 token leaked — use a fresh bot)
TELEGRAM_CHAT_ID=     ← @userinfobot
```
After editing: `docker compose -f AGENTS/claude/automation/docker-compose.yml up -d --force-recreate`, then `bash AGENTS/claude/automation/send-test-brief.sh` to verify.

## Deferred (unchanged)

Gmail inbox + social analytics branches were dropped from the workflow until their credentials exist (Gmail OAuth = the Google Cloud rabbit hole per GEN-1 Step 10). Add them back as parallel branches into Compile Brief when ready.
