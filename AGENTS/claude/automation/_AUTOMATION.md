# _AUTOMATION — local n8n

Back to [[MAP]].

- `morning_brief.workflow.json` — import into local n8n (not a note, so it won't appear as a graph node)
- [[README]] in this folder — how to import + wire credentials
- [[FLOW_GRAPH]] — mobile + backend code-flow scanner. **Read the graph FIRST** for any nav / 404 / dead-end question. Regenerate with `python tools/flow_graph.py`.

The morning workflow reads [[STATUS]] + [[SESSION_LOG]], pulls email + social, and the [[assistant]] agent compiles it into your Morning Brief (see [[DISPATCH_GATE]] Layer 5).
