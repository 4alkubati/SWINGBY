# Deploying SwingBy

Covers: backend to Render, frontend to Cloudflare Pages, environment variable checklist.

See also: `docs/DEPLOY.md` for the original Render-specific guide.

---

## Backend — Render

**Service:** `swingby-api` (Docker, free plan)
**Auto-deploy:** On push to `main` from `backend/`

### First deploy

1. Go to [render.com](https://render.com) and connect the GitHub repo `4alkubati/SWINGBY`.
2. Create a new **Web Service** → **Existing Dockerfile** → root dir: `backend`.
3. Alternatively, use `backend/render.yaml` with the Render CLI (`render deploy`).
4. Set all env vars in Render dashboard (see checklist below).

### Environment variables (backend)

| Key | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase → Project → Settings → Database → Connection string |
| `SUPABASE_URL` | Supabase → Project → Settings → API → Project URL |
| `SUPABASE_KEY` | Supabase → Project → Settings → API → anon/public key |
| `SUPABASE_SERVICE_KEY` | Supabase → Project → Settings → API → service_role key |
| `SECRET_KEY` | Generate: `openssl rand -hex 32` |
| `SWINGBY_ALLOWED_ORIGINS` | Comma-separated list of frontend origins (e.g. `https://swingbyy.com,https://admin.swingbyy.com`) |
| `AWS_BUCKET` | Leave empty until S3 file uploads are needed |

### Health check

`GET https://swingby-api.onrender.com/health` → `{"status":"ok"}`

On Render free plan: service spins down after 15 min idle; first request takes ~30s to warm up.

---

## Frontend — Cloudflare Pages

**Sites:**
- `web/launch/` → `swingbyy.com`
- `web/pre-launch/` → pre-launch.swingbyy.com (or separate project)
- `web/admin/` → admin.swingbyy.com

### Deploy to Cloudflare Pages

1. Go to Cloudflare dashboard → Workers & Pages → Create application → Pages → Connect to Git.
2. Select the repo `4alkubati/SWINGBY`.
3. Build settings:
   - **Root directory:** `web/launch` (or `web/pre-launch`, `web/admin`)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** 20 (set in environment variable `NODE_VERSION=20`)
4. Set environment variables (see below).
5. Add custom domain in Cloudflare DNS.

### Environment variables (web/launch)

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
| `VITE_API_BASE_URL` | Render backend URL |
| `VITE_SENTRY_DSN` | Sentry DSN (optional) |
| `VITE_PLAUSIBLE_DOMAIN` | `swingbyy.com` |
| `VITE_MAINTENANCE_MODE` | `false` |

### CSP and security headers

`web/launch/public/_headers` is served by Cloudflare Pages automatically. Covers CSP, X-Frame-Options, HSTS, etc. Review and update when adding new external services.

---

## Environment variable checklist (before going live)

- [ ] `SUPABASE_SERVICE_KEY` set in Render (backend only, never in frontend)
- [ ] `SECRET_KEY` is a real random 32-char string, not a default
- [ ] `SWINGBY_ALLOWED_ORIGINS` includes the production frontend domain
- [ ] `VITE_SUPABASE_ANON_KEY` used in frontend (not the service key)
- [ ] Sentry DSN configured for error monitoring
- [ ] Plausible domain configured for analytics
- [ ] Custom domain DNS pointing to Cloudflare Pages
- [ ] SSL is active on Cloudflare (Full strict mode)

---

## Rollback

See `docs/ROLLBACK.md` for the full rollback procedure if a deploy breaks production.
