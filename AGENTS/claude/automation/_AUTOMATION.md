# _AUTOMATION — local n8n

Back to [[MAP]].

- `docker-compose.yml` — n8n lives in Docker (`swingby-n8n`, http://localhost:5678). Secrets: `.claude/secrets/n8n.env`.
- `morning_brief.workflow.json` — imported + ACTIVE (06:05 America/Edmonton → Telegram). Edit the file, re-import, restart the container ([[README]] has the commands).
- `send-test-brief.sh` — fire the brief now to test delivery.
- `run-overnight.sh` — overnight build loop; works the 🌙 Tonight queue in [[PLAN]].
- [[FLOW_GRAPH]] — mobile + backend code-flow scanner. **Read the graph FIRST** for any nav / 404 / dead-end question. Regenerate with `python tools/flow_graph.py`.

The morning workflow reads [[STATUS]] + [[HUMAN-TODO]] + [[SESSION_LOG]] + the overnight log tail and sends the compiled brief to Telegram (format per [[DISPATCH_GATE]] Layer 5). Email + social branches return when their creds exist.
