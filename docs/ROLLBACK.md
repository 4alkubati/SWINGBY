# SwingBy — Rollback Runbook

Step-by-step recovery procedures by failure mode. Keep this in `docs/` so it's versioned with the code.

---

## 0. Decide which kind of rollback you need

| Symptom | Rollback type | Section |
|---|---|---|
| Latest deploy broken, prior deploy was fine | Render rollback | §1 |
| Backend code regression but deploy is technically healthy | Git revert + push | §2 |
| Schema migration broke production | Supabase migration revert | §3 |
| Mobile build crashes on launch | EAS Build rollback | §4 |
| Cloudflare Worker / Pages regression | Wrangler rollback | §5 |
| Data corrupted by bad migration / bug | Backup restore | §6 |

---

## 1. Render — Roll back the API to a previous deploy

1. Open https://dashboard.render.com → `swingby-api` service
2. Click **Events** in left nav
3. Find the last green "Deploy live" event
4. Click **⋮** menu → **Rollback to this deploy**
5. Render rebuilds the prior image from the same commit SHA (~3 min)
6. Verify `/healthz` is 200

Free tier note: rollbacks are unlimited and free.

---

## 2. Git revert (when the bad change is in a single commit)

```bash
cd "C:/Users/amrba/OneDrive/Desktop/AMR/CODE/Swingby"
git log --oneline -10
git revert <BAD_COMMIT_SHA> --no-edit
git push origin main
```

Render's `autoDeploy: true` picks it up automatically. Watch the Events page until live.

---

## 3. Supabase migration revert

There is no "Undo last migration" button. You must apply a counter-migration.

1. Inspect the bad migration in Supabase Dashboard → Database → Migrations
2. Author a counter-migration that reverses the schema change. For each kind of change:

   | Bad change | Counter-migration |
   |---|---|
   | `CREATE TABLE foo` | `DROP TABLE foo CASCADE` |
   | `ALTER TABLE x ADD COLUMN y` | `ALTER TABLE x DROP COLUMN y` |
   | `CREATE INDEX z` | `DROP INDEX z` |
   | `CREATE POLICY` | `DROP POLICY name ON table` |

3. Apply via `mcp__claude_ai_Supabase__apply_migration` with name `20YYMMDD_revert_<original>`
4. Verify with `list_migrations` + `get_advisors`

Always test counter-migrations on a Supabase branch first if Pro tier.

---

## 4. Mobile (EAS Build) rollback

If a TestFlight / Play Store release crashes:

1. **Immediate:** in App Store Connect, **stop the phased release** for the broken version
2. **Recover:** push the prior known-good binary via TestFlight's "Roll out previous version" (Apple keeps the last 5)
3. **OTA-style:** if the regression is JS-only, ship a hotfix via EAS Update:
   ```bash
   cd mobile
   eas update --branch production --message "rollback regression in feature X"
   ```
   EAS Update pushes the prior JS bundle to all installed apps in ~5 min.

---

## 5. Cloudflare Worker / Pages rollback

### Worker (swingby-waitlist)
```bash
wrangler deployments list --name swingby-waitlist
wrangler rollback <DEPLOYMENT_ID> --name swingby-waitlist
```

### Pages (swingby-prelaunch)
Cloudflare Dashboard → Pages → swingby-prelaunch → **Deployments** → click ⋮ on prior deploy → **Rollback**.

---

## 6. Data corruption — restore from backup

See `docs/SUPABASE_BACKUP.md` for the full procedure. TL;DR for Pro tier:

1. Supabase Dashboard → Database → Backups → PITR
2. Pick the timestamp just before corruption
3. **Clone to a new schema** (`restore_2026_05_28`) — do NOT overwrite production schema in-place
4. Diff data, then atomically swap (rename schemas inside a transaction)
5. Run `get_advisors` to confirm no RLS regression

Free tier: use your latest weekly `pg_dump` (see `docs/SUPABASE_BACKUP.md` §weekly).

---

## 7. Post-rollback checklist

| Item | Done? |
|---|---|
| Rolled-back deploy/Pages/Worker is the live one | ☐ |
| `/healthz` returns 200 | ☐ |
| `/health` returns DB connected | ☐ |
| Mobile app login works (test with seed accounts) | ☐ |
| Supabase advisors show no NEW errors | ☐ |
| Audit log captures the rollback event (write a manual entry) | ☐ |
| Slack/email the team that rollback completed | ☐ |
| Root-cause write-up filed in `docs/incidents/<date>.md` | ☐ |

---

## 8. What we don't roll back

- **Customer data writes after the bad deploy** — those are real records. If they need cleanup, do it forward (data migration), not by erasing.
- **Audit log entries** — append-only by design.
- **Successful payments** — never roll back a payment record. Refund forward.
