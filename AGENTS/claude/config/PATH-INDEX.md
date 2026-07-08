# PATH-INDEX — where everything is (never grep for paths)

> Read this once at startup. Jump straight to the file. Searching the repo wastes tokens.
> Repo root: `C:/Users/amrba/OneDrive/Desktop/AMR/CODE/Swingby`

## Backend (FastAPI) — `backend/app/`
- `main.py` — app + routers · `config.py` — env/settings · `database.py`, `supabase_client.py`, `deps.py`
- `api/` — auth, bookings, businesses, employees, interests, me, messages, payments, push_tokens, reviews, service_posts, uploads, waitlist, admin, contact
- `services/` — `email.py` (Resend), `notion_crm.py`
- env: `backend/.env` (gitignored) · deploy: `render.yaml`

## Mobile (Expo) — `mobile/`
- `App.js`, `index.js`, `app.json`, `eas.json` · env: `mobile/.env`
- `src/screens/` (buckets: auth, onboarding, admin, business, client, flows, messages, profile, shared)
- `src/components/`, `src/context/` (Auth, Booking), `src/navigation/`, `src/services/` (api.js, auth.js, location.js)

## Web — `web/`
- `pre-launch/`, `launch/`, `admin/` (Vite + React). Pages in `src/pages/`.

## Workers — `workers/` (Cloudflare; waitlist worker)

## The agent kit — `AGENTS/`
- `claude/ORCHESTRATOR.md` · `claude/config/` (DISPATCH_GATE, LOOP, ROUTING, MCP_INVENTORY, PATH-INDEX, NOTION_SYNC)
- `claude/memory/` (STATUS, PLAN, SESSION_LOG, MESSAGE_BUS, HUMAN-TODO, ORCHESTRATOR_ISSUES)
- `claude/skills/`, `claude/automation/`, `claude/PRODUCT-VISION.md`
- `BOH/` (technical agents) · `FOH/` (marketing/pr/assistant) · briefs: `AGENTS/briefs/BRIEF-*.md`

## Planning / FOH (don't read for code tasks) — `marketing/`, `Roadmap/`, `design/`, `docs/`, `privacy-and-security/`

## Don't touch / not load-bearing
- Secrets: `backend/.env`, `.claude/secrets/`, `credentials/` (gitignored)
- Build artifacts: any `dist/`, `node_modules/`, `__pycache__/`


---
*[[MAP]] · read at startup by [[LOOP]] so agents never grep for paths*
