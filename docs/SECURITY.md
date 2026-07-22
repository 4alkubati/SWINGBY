---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build]
---
# SwingBy — Security Checklist

| Item | Status |
|---|---|
| RLS on all 10 tables | ✅ Applied via MCP |
| Supabase security advisors | ⚠️ 1 open — HIBP leaked-password protection disabled (dashboard-only toggle, Auth → Sign In / Providers → Password → "Leaked password protection" → Enable). 2 others (disputes trigger fn missing pinned `search_path`, `job-photos` bucket publicly listable) fixed 2026-07-19 via `docs/card06_security_advisors_fix.sql` (CARD-06). Verify live with `mcp__claude_ai_Supabase__get_advisors` before checking this row off — don't trust this line without re-running it. |
| No table open to anon | ✅ Zero anon policies |
| Service role key backend-only | ✅ Never in mobile/ or web/ |
| `.env` not in git | ✅ Confirmed via git ls-files |
| All routes auth-protected | ✅ 2 intentionally open (signup/login) |
| Input validation on all models | ✅ Pydantic Field constraints + EmailStr |
| supabase_client hard-fails if key missing | ✅ RuntimeError at startup |
| Post expiry cron (hourly, pg_cron) | ✅ Live on Supabase |
| JWT expiry | ✅ 3600s default (free plan, not configurable) |
| Email confirmation | ⚠️ Check: Auth → Sign In / Providers → Email → "Confirm email" ON |
| AWS S3 bucket | ⚪ Not needed — using Supabase Storage instead |
| Supabase Storage bucket job-photos | ✅ Created 2026-06-15 — public read, 10 MB limit, images only |
| Image upload endpoint /uploads/image | ✅ backend/app/api/uploads.py — validates type+size, auth-protected |
| CSP headers (_headers for Cloudflare/Netlify) | ✅ web/launch/public/_headers |
| Admin role in DB constraint | ✅ wave-5-admin-role.sql applied, amrbasem37@gmail.com = admin |
| CI secret scan + npm audit | ✅ .github/workflows/web-launch-ci.yml |
| react-router-dom XSS (GHSA-2w69) | ✅ Upgraded to 6.30.4 |
| xlsx prototype pollution (no npm fix) | ✅ Replaced with ExcelJS |

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]

**Related:** [[2026-07-19]]
<!-- graph-wire:end -->
