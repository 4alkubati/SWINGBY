# AGENTS — portable multi-agent kit

A drop-in agent system. Copy this folder into any project, point it at the repo, and run. One Opus orchestrator plans and reviews; Sonnet/Haiku workers build; a file-based message bus carries everything. Memory lives in this folder, so each project gets its own brain.

Built for Kira's operating model: **he directs, agents build overnight, he reviews ~2 hrs.** The system is designed so his review window is decisions, not debugging.

> **The sync rule:** this folder is the source of truth for agent behavior. Any change to how agents operate — gates, routing, loop rules, skills — is edited here and committed **before** it's applied in a live session. A session that discovers a better way of working writes it back here as its last act. New project? Don't copy by hand — see [[KICKOFF]].

---

## The 7-layer gate (the spine)

Every task passes `claude/config/DISPATCH_GATE.md`:

1. **Frame** — 5W+H. No blanks.
2. **Obstacle train** — every blocker as a station; each station looks easy.
3. **Read memory, write plan** — separate *what Kira does* from *what the agent does*.
4. **Prep + run** — Kira does human-only steps, then BOH ∥ FOH run overnight.
5. **Two briefs** — BOH Night Build Summary + FOH Morning Image Brief.
6. **Review & execute** — orchestrator pre-digests; Kira decides.
7. **Frame the next** — tomorrow's first task is already written.

---

## The kitchen: BOH vs FOH

| BOH (technical, hidden) | FOH (the image customers see) |
|---|---|
| backend, frontend, mobile, database, design, security, qa | marketing, pr, assistant |
| ships the product | fills the funnel + runs the morning brief |

---

## Folder map (three folders, two files)

```
AGENTS/
├── README.md                  ← this file
├── MAP.md                     ← Obsidian hub (graph view starts here)
├── BOH/                       ← Back of House (technical agents)
│   ├── _BOH.md  backend.md  frontend.md  mobile.md
│   ├── database.md  design.md  security.md  qa.md
├── FOH/                       ← Front of House (the image)
│   ├── _FOH.md  marketing.md  pr.md  assistant.md
└── claude/                    ← the engine
    ├── ORCHESTRATOR.md        ← Opus master (plans, delegates, reviews — never codes)
    ├── config/                ← DISPATCH_GATE.md  ROUTING.md  MCP_INVENTORY.md
    ├── memory/                ← STATUS.md  PLAN.md  SESSION_LOG.md  MESSAGE_BUS.md
    └── automation/            ← morning_brief.workflow.json (local n8n)
```

---

## Deploy into a project

1. Copy the whole `AGENTS/` folder into the project root.
2. Open `claude/memory/STATUS.md`, set **Active Project** + **Repo Path** to the project.
3. Start the orchestrator:
   ```bash
   cd <project>/AGENTS/claude
   claude --dangerously-skip-permissions
   ```
   Then say: **"Read ORCHESTRATOR.md and start."**
4. The orchestrator reads its memory + the repo's `CLAUDE.md`, then runs INTAKE or CONTINUE.

Memory paths are relative, so the brain travels with the folder. One kit, many projects.

---

## Overnight + morning loop

- **Night:** orchestrator dispatches BOH (and FOH drafts), agents work, results land on the bus + SESSION_LOG.
- **Morning:** local n8n runs `claude/automation/morning_brief.workflow.json` → assistant-agent compiles the brief → it's waiting whe