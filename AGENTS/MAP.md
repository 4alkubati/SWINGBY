# 🗺️ AGENTS — MAP

The center of the vault. Everything links from here.

## Root files
- [[README|AGENTS README]] — what this kit is + how to deploy
- [[KICKOFF]] — spin this kit up in a NEW project (generates AGENTS/ + Roadmap/ + CLAUDE.md)

## The folders
- [[BOH/_BOH|_BOH]] — Back of House: the technical team (backend, frontend, mobile, database, design, security, qa)
- [[FOH/_FOH|_FOH]] — Front of House: the image (marketing, pr, assistant)
- `briefs/` — one-off orchestrator briefs (completed briefs stay here as history)
- **claude/** — the engine:
  - [[claude/ORCHESTRATOR|ORCHESTRATOR]] — the manager agent
  - [[claude/PRODUCT-VISION|PRODUCT-VISION]] — what we are building (role-sliced)
  - [[claude/config/_CONFIG|_CONFIG]] — rulebooks: [[claude/config/DISPATCH_GATE|DISPATCH_GATE]], [[claude/config/ROUTING|ROUTING]], [[claude/config/LOOP|LOOP]], [[claude/config/MCP_INVENTORY|MCP_INVENTORY]], [[claude/config/PATH-INDEX|PATH-INDEX]], [[claude/config/NOTION_SYNC|NOTION_SYNC]]
  - [[claude/memory/_MEMORY|_MEMORY]] — the brain: [[claude/memory/STATUS|STATUS]], [[claude/memory/HUMAN-TODO|HUMAN-TODO]], [[claude/memory/PLAN|PLAN]], [[claude/memory/SESSION_LOG|SESSION_LOG]], [[claude/memory/MESSAGE_BUS|MESSAGE_BUS]], [[claude/memory/ORCHESTRATOR_ISSUES|ORCHESTRATOR_ISSUES]]
  - [[claude/skills/_SKILLS|_SKILLS]] — reusable techniques (debugging, planning, review, design)
  - [[claude/automation/_AUTOMATION|_AUTOMATION]] — n8n morning brief + [[claude/automation/FLOW_GRAPH|FLOW_GRAPH]] scanner
  - `claude/deliverables/` — dated audit/spec outputs (append-only history)

## The rule that keeps this folder true
**AGENTS/ is the source of truth for agent behavior.** Any change to how agents operate — gates, routing, loop rules, skills, briefs — is edited HERE and committed BEFORE it's applied in a live session. If a session invents a better way of working, its last job is to write that improvement back into this folder.

## Where the plan lives (outside this folder)
- [[../Roadmap/DOMINOES|DOMINOES]] — the ordered path to launch (each domino = its own file, book convention)
- [[../Roadmap/README|Roadmap README]] — north star + phases
- [[../CLAUDE.md|CLAUDE.md]] — master context every session reads first
