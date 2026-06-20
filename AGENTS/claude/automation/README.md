# automation — local n8n

## morning_brief.workflow.json

The "make coffee, come back to a plan" workflow. Runs each morning on your locally-hosted n8n.

### What it does (node by node)

1. **Schedule Trigger** — fires daily at 06:05 (edit the cron to your wake time).
2. **Read Overnight Status** — reads `AGENTS/claude/memory/STATUS.md` + last `SESSION_LOG.md` entry (what the BOH agents shipped overnight).
3. **Gmail — Unread** — pulls unread/important threads needing a reply.
4. **Social Analytics** — placeholder HTTP node: point it at your analytics source (Plausible API, IG/FB Graph, etc.).
5. **Compile Brief (Code node)** — merges all inputs into the Morning Image Brief format from `DISPATCH_GATE.md` Layer 5.
6. **Deliver** — placeholder: send the brief to yourself (email/Telegram/Notion). Wire to your channel of choice.

### Import + wire

1. n8n → Workflows → Import from File → select `morning_brief.workflow.json`.
2. Attach credentials on the Gmail node (and any HTTP node that needs auth).
3. Update the **Read Overnight Status** file path to wherever `agent-os/memory/` lives on your machine.
4. Set the cron to your wake time. Activate.

### Note
Nodes are scaffolds with sensible defaults — credentials and exact endpoints are yours to attach. The workflow imports cleanly without them; it just won't execute until creds are 