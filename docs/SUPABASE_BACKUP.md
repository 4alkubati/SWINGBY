---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build]
---
# SwingBy — Supabase Backup & Recovery Policy

What Supabase backs up automatically, what you must back up yourself, and how to restore.

---

## What Supabase backs up automatically

### Free tier
- **Daily full backups**, retained for **7 days**
- Backups are **read-only** — you cannot restore from them on the free plan
- Available in Dashboard → **Settings** → **Backups** (view only)

### Pro tier ($25/mo) — recommended once live
- **Daily backups, 7-day point-in-time recovery (PITR)** at 2-minute granularity
- One-click restore to any point in the last 7 days
- WAL-based — minimal RPO

### Team tier ($599/mo)
- 14-day PITR, custom restore windows, dedicated support

**Recommendation:** Upgrade to **Pro** before public launch. The cost of a 24-hour data-loss incident dwarfs $25.

---

## What you must back up yourself

### Schema migrations (already covered)
All migrations live in Supabase under **Database → Migrations**. Mirror them to `docs/migrations/` in this repo:
- Run `mcp__claude_ai_Supabase__list_migrations` to inspect
- Existing applied migrations are documented in `docs/rls_policies.sql`, `docs/expiry_cron.sql`, and the `20260527_push_tokens` migration

### Storage buckets (when file uploads ship)
Supabase Storage **is included** in backups starting at Pro tier. On free tier, **storage is NOT backed up**. Until file uploads ship (post-MVP), this is moot.

### Edge functions
Edge functions are part of the project; they're backed up with the daily snapshot. Source-of-truth is git.

---

## Weekly manual backup procedure (free tier mitigation)

Until you upgrade to Pro, run a logical dump weekly:

```bash
# Requires pg_dump installed locally; DATABASE_URL from backend/.env
pg_dump "$DATABASE_URL" --schema=public --no-owner --no-acl -Fc \
  -f "swingby_backup_$(date +%Y%m%d).dump"
```

Store the dump in encrypted cloud storage (BackBlaze B2, Wasabi, S3 with KMS). **Never commit dumps to git.**

Restore:
```bash
pg_restore --dbname="$DATABASE_URL" --no-owner --no-acl swingby_backup_YYYYMMDD.dump
```

---

## Incident response runbook

| Severity | Trigger | Action |
|---|---|---|
| LOW | Single user reports lost data | Check `audit_log` (Wave 6 will add this) before restoring anything |
| MEDIUM | Table-level corruption | Pro tier PITR → restore to a fresh schema + diff before swapping |
| CRITICAL | Whole DB lost / encryption attack | Free: contact Supabase support + last weekly pg_dump. Pro: PITR rollback. |

---

## Verify backups quarterly

Once per quarter:
1. Spin up a temporary Supabase project
2. Restore the latest pg_dump into it
3. Run a quick smoke query (`SELECT COUNT(*) FROM businesses;`)
4. Tear it down

A backup you've never restored from is a backup that doesn't exist.

---

## RLS in backups
Backups preserve all RLS policies. After restore, run `mcp__claude_ai_Supabase__get_advisors` to confirm no policies regressed.

<!-- graph-wire:start -->
---
**Up:** [[MOC-Build]] · **Home:** [[SWINGBY]]
<!-- graph-wire:end -->
