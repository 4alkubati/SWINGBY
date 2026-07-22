---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build]
---
# SwingBy — Backend Deploy Guide (Render)

Single source of truth for deploying `backend/` to Render. ~10 minutes start to finish.

---

## Prerequisites
- GitHub repo: `4alkubati/SWINGBY` (already set up)
- Render account: https://render.com (free, GitHub OAuth)
- `backend/.env` populated locally (the values you'll paste into Render)

---

## One-time setup

### Step 0 — Push latest backend to GitHub
Render builds from the `main` branch. Make sure `backend/Dockerfile`, `backend/render.yaml`, `backend/.dockerignore`, and all Phase 5/6 code are on `main`:

```bash
cd "C:/Users/amrba/OneDrive/Desktop/AMR/CODE/Swingby"
git add backend mobile web/pre-launch/.env.production
git commit -m "Backend deploy artifacts + push notifications"
git push origin main
```

### Step 1 — Create the Render Web Service
1. Sign in to https://render.com with GitHub
2. **New +** → **Web Service** → **Connect a repository**
3. Authorize Render for the `4alkubati/SWINGBY` repo
4. Fill the form:

   | Field | Value |
   |---|---|
   | Name | `swingby-api` |
   | Region | `Oregon (US West)` or `Ohio` |
   | Branch | `main` |
   | Root Directory | `backend` |
   | Runtime | auto-detected (`Docker` from `render.yaml`) |
   | Plan | `Free` |

### Step 2 — Paste environment variables
In the **Environment Variables** section, add each row. Values come from your local `backend/.env`:

| Key | Value source |
|---|---|
| `DATABASE_URL` | from `backend/.env` |
| `SUPABASE_URL` | `https://ulnxapnsenzyddddldjt.supabase.co` |
| `SUPABASE_SERVICE_KEY` | from `backend/.env` — **must be set** or the server refuses to start |
| `SUPABASE_KEY` | from `backend/.env` (anon key) |
| `SECRET_KEY` | any 32+ char random string |
| `SWINGBY_ALLOWED_ORIGINS` | `https://swingbyy.com,https://swingby-prelaunch-1pv.pages.dev` |
| `NOTION_TOKEN` | from `backend/.env` (only if `/waitlist` should serve from Render too) |
| `SENTRY_DSN` | leave blank for now (Sentry is wired but inactive without DSN) |

### Step 3 — Create the service
Click **Create Web Service**. Render runs the Docker build, then `uvicorn`.
First build: ~3–5 min.

### Step 4 — Verify liveness
When status reads **Live**, Render shows the URL (the live service is `https://swingbyy-api.onrender.com` — note the double-y; the single-y `swingby-api.onrender.com` is not a live server).

Open `/healthz` in a browser — should return `{"status":"ok"}` instantly.
Open `/health` — returns `{"status":"ok","database":"connected"}` once DB env vars are correct.

### Step 5 — Wire mobile + web to the live URL
```
# mobile/.env
EXPO_PUBLIC_API_URL=https://swingbyy-api.onrender.com

# web/pre-launch/.env.production — leave existing VITE_API_URL=https://api.swingbyy.com
# (api.swingbyy.com is the Worker, not Render — keep them separate)
```

Rebuild mobile: `expo prebuild --clean && eas build` (or `expo start` for dev).

---

## Subsequent deploys
`autoDeploy: true` is set in `render.yaml`. Every push to `main` triggers a build.

Manual trigger: Render dashboard → **Manual Deploy** → **Deploy latest commit**.

---

## Free-tier caveats
- Service sleeps after 15 min of inactivity. First request after sleep takes ~30 sec.
- Upgrade to **Starter** ($7/mo) for always-on once you have real users.
- Free Postgres is on Supabase, not Render — unaffected by Render plan.

---

## Common failures

| Symptom | Fix |
|---|---|
| Build fails at `pip install psycopg2-binary` | The Dockerfile already installs `libpq5`. If still broken, switch `requirements.txt` to `psycopg[binary]` (Psycopg 3) |
| App boots but `/health` returns DB error | `DATABASE_URL` malformed — must start with `postgresql://` (not `postgres://`) |
| 502 Bad Gateway right after deploy | First boot still warming. Wait 30 sec, hit `/healthz` again |
| CORS blocks browser requests | Add the origin to `SWINGBY_ALLOWED_ORIGINS` (comma-separated, no spaces) |
| Push notifications silently fail | `SUPABASE_SERVICE_KEY` not set or wrong — `send_push_to_user` swallows the error but no notifications go out |

---

## Rollback
See `docs/ROLLBACK.md`.

---

## Frontend — Cloudflare Pages

**Sites:**
- `web/launch/` → `swingbyy.com`
- `web/pre-launch/` → pre-launch site
- `web/admin/` → admin dashboard

### Deploy to Cloudflare Pages

1. Cloudflare dashboard → Workers & Pages → Create application → Pages → Connect to Git.
2. Select `4alkubati/SWINGBY`.
3. Build settings:
   - **Root directory:** `web/launch` (or `web/pre-launch`, `web/admin`)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 20 (set via env var `NODE_VERSION=20`)
4. Set environment variables (below).
5. Add custom domain in Cloudflare DNS.

### Frontend env vars (web/launch)

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (never the service key) |
| `VITE_API_BASE_URL` | Render backend URL |
| `VITE_SENTRY_DSN` | Sentry DSN (optional) |
| `VITE_PLAUSIBLE_DOMAIN` | `swingbyy.com` |
| `VITE_MAINTENANCE_MODE` | `false` |

### CSP and security headers

`web/launch/public/_headers` is served by Cloudflare Pages automatically. Covers CSP, X-Frame-Options, HSTS. Review when adding external services.

---

## Full environment checklist (before going live)

- [ ] `SUPABASE_SERVICE_KEY` set in Render (backend only, never in frontend)
- [ ] `SECRET_KEY` is a real random 32-char string, not a default
- [ ] `SWINGBY_ALLOWED_ORIGINS` includes the production frontend domain
- [ ] `VITE_SUPABASE_ANON_KEY` used in frontend (not the service key)
- [ ] Sentry DSN configured
- [ ] Plausible domain configured
- [ ] Custom domain DNS pointing to Cloudflare Pages
- [ ] SSL is active on Cloudflare (Full strict mode)

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]
<!-- graph-wire:end -->
