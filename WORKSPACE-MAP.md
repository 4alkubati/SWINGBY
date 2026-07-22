---
group: core
project: swingby
hub: "[[SWINGBY]]"
tags: [core]
---
# SwingBy — Workspace Map (which chat works where)

> Two chats, one project. This map keeps them in their lanes. Folders are NOT moved — `backend/`, `mobile/`, `web/`, `workers/` MUST stay at the repo root (builds + deploys depend on it). This is a convention, not a restructure.

## 🛠️ [[_BOH]]BOH — Claude Code chat (technical execution)
- `backend/` — FastAPI API
- `mobile/` — React Native + Expo app
- `web/` — pre-launch, launch, admin sites
- `workers/` — Cloudflare workers
- `AGENTS` — gitignored symlink → `/home/l3thal/brain/10-swingby/agents/` (the agent kit: orchestrator, BOH/FOH agents, skills, memory — lives in the brain now, versioned by the brain's git).

## 🎨 FOH — Cowork chat (image, planning, strategy)
- `marketing/` — monetization, pricing, GTM, positioning, brand, content calendar, KPIs
- `design/` — visuals, brand assets, UI direction (Claude Design lives here later)
- `Roadmap/` — daily plans (`June/`, `July/`, `August/`), costs, template
- `project-docs/`, `docs/` — documentation
- `privacy-and-security/` — legal, policies

## 🔗 Shared
- `CLAUDE.md` — master context for any Claude session (read first)
- `README.md`, `WORKSPACE-MAP.md` (this file)
- `credentials/` — local-only vault for test accounts + API keys. **Gitignored**
  except its `README.md`. Subfolders: `test-accounts/`, `api-keys/`. Drop one
  markdown file per service. See `credentials/README.md` for layout.
- `docs/legal/` — dev-facing copies of `PRIVACY_POLICY.md` + `TERMS_OF_SERVICE.md`.
  Canonical legal-program copies live in `privacy-and-security/`; live web copies
  in `web/launch/src/pages/PrivacyPage.jsx` + `TermsPage.jsx`. Update all three.

## Rules
- BOH chat edits code folders; FOH chat edits planning/marketing/design folders.
- Neither moves `backend/ mobile/ web/ workers/` — they stay at root.
- Secrets never in chat or committed files. `.claude/secrets/` holds live agent
  secrets; `credentials/` holds everything else a human might need locally.
- `CNAME` at root is a vestige of an earlier GitHub Pages deploy
  (commit 58460b1). Current deploys are Cloudflare Pages + Render. Verify it's
  not load-bearing before deleting.

<!-- graph-wire:start -->
---
**Up:** [[SWINGBY]] · **Home:** [[SWINGBY]]

**Related:** [[CLAUDE]] · [[PRIVACY_POLICY]] · [[TERMS_OF_SERVICE]]
<!-- graph-wire:end -->
