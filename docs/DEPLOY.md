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
When status reads **Live**, Render shows the URL (e.g. `https://swingby-api.onrender.com`).

Open `/healthz` in a browser — should return `{"status":"ok"}` instantly.
Open `/health` — returns `{"status":"ok","database":"connected"}` once DB env vars are correct.

### Step 5 — Wire mobile + web to the live URL
```
# mobile/.env
EXPO_PUBLIC_API_URL=https://swingby-api.onrender.com

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
