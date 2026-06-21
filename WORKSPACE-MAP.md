# SwingBy — Workspace Map (which chat works where)

> Two chats, one project. This map keeps them in their lanes. Folders are NOT moved — `backend/`, `mobile/`, `web/`, `workers/` MUST stay at the repo root (builds + deploys depend on it). This is a convention, not a restructure.

## 🛠️ BOH — Claude Code chat (technical execution)
- `backend/` — FastAPI API
- `mobile/` — React Native + Expo app
- `web/` — pre-launch, launch, admin sites
- `workers/` — Cloudflare workers
- `AGENTS/` — the agent kit (orchestrator, BOH/FOH agents, skills, memory). Code runs it; briefs come from here.

## 🎨 FOH — Cowork chat (image, planning, strategy)
- `marketing/` — monetization, pricing, GTM, positioning, brand, content calendar, KPIs
- `design/` — visuals, brand assets, UI direction (Claude Design lives here later)
- `Roadmap/` — daily plans (`June/`, `July/`, `August/`), costs, template
- `project-docs/`, `docs/` — documentation
- `privacy-and-security/` — legal, policies

## 🔗 Shared
- `CLAUDE.md` — master context for any Claude session (read first)
- `README.md`, `WORKSPACE-MAP.md` (this file)

## Rules
- BOH chat edits code folders; FOH chat edits planning/marketing/design folders.
- Neither moves `backend/ mobile/ web/ workers/` — they stay at root.
- Secrets never in chat or committed files (`.claude/secrets/` is gitignored).
