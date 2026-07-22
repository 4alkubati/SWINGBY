---
group: trust
project: swingby
hub: "[[MOC-Trust]]"
tags: [trust]
---
# Security Checklist — Internal Quarterly Audit

> Run this every 90 days. Check each item. Fix gaps before the next quarter.

**Last run:** [Date]  
**Next scheduled:** [Date + 90 days]  
**Run by:** [Name]

---

## How to use this checklist

Work through each section. For each item:
- `[x]` — Confirmed passing
- `[ ]` — Not yet checked
- `[!]` — Issue found (add a note below the item with the gap and a fix deadline)

At the end, compile a summary of all `[!]` items and create action items in your task tracker.

---

## Section 1 — Authentication and authorization

- [ ] **Supabase Auth rate limiting is enabled** — verify in Supabase dashboard: Auth → Settings → Rate Limits
- [ ] **Row Level Security is enabled on all 10 tables** — run: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';` — all should show `t`
- [ ] **No table has an open `anon` select policy** — run: `SELECT * FROM pg_policies WHERE roles = '{anon}';` — should be empty
- [ ] **Service role key is NOT in any frontend code or committed to git** — run: `git log -p --all -- '*.env*' | grep SUPABASE_SERVICE_KEY` — should be empty
- [ ] **All admin accounts (Supabase, Stripe, hosting, GitHub) have MFA enabled** — verify by logging into each console
- [ ] **JWT expiry is set to ≤ 3600s** — verify in Supabase Auth settings
- [ ] **Backend API returns 401 (not 403 or 200) on unauthenticated requests to protected routes** — test manually with no token

---

## Section 2 — Data protection

- [ ] **TLS is enforced on all public API endpoints** — test: `curl -v http://api.swingbyy.com/health` — should redirect to HTTPS or refuse plaintext
- [ ] **No plaintext password is stored anywhere in the database** — verify: `SELECT COUNT(*) FROM users WHERE password IS NOT NULL;` — should be 0 (passwords are hashed by Supabase Auth)
- [ ] **No credit card data (PAN, CVV, expiry) is stored in SwingBy's database** — confirm Stripe integration only stores intent IDs
- [ ] **Supabase storage buckets have appropriate access controls** — verify in Supabase Storage: no bucket is set to "public" unless it contains intentionally public assets
- [ ] **Database backups are enabled and recent** — verify in Supabase dashboard: Settings → Backups — confirm last backup < 48 hours ago

---

## Section 3 — Logging and monitoring

- [ ] **Sentry is receiving events** — verify in Sentry dashboard: confirm events are flowing from both backend and web/mobile
- [ ] **Sentry is NOT logging PII** — review last 20 events: confirm no email addresses, phone numbers, or full message content in error payloads
- [ ] **Uptime monitoring is active** — verify external monitor is configured and has not triggered an alert in the last 7 days without being noticed
- [ ] **Authentication failure events are being logged** — test: attempt login with wrong password 5 times; confirm a log entry appears
- [ ] **Log retention policy is enforced** — confirm logs older than 90 days are being purged (Supabase logs, Sentry)

---

## Section 4 — Backups and recovery

- [ ] **Supabase backup is on** — Settings → Backups → confirm automated backups are enabled
- [ ] **Recovery has been tested** — at least once in the last 6 months, confirm you can restore to a test environment from backup
- [ ] **Environment variables are documented** — confirm all required env vars are listed in a secure password manager or equivalent (NOT in `.env` committed to git)
- [ ] **Deployment can be rolled back in < 30 minutes** — confirm hosting provider supports one-click rollback to previous version

---

## Section 5 — Secrets and credentials

- [ ] **`.env` file is not in the git repository** — run: `git ls-files | grep .env` — should be empty
- [ ] **`SUPABASE_SERVICE_KEY` is not in git history** — run: `git log -p --all | grep SUPABASE_SERVICE_KEY` — should be empty
- [ ] **Stripe secret key is not in git history** — run: `git log -p --all | grep sk_live` — should be empty
- [ ] **All credentials rotate schedule is current** — confirm Meta/LinkedIn tokens are not expired (they expire every 60 days)
- [ ] **Supabase service role key is set as an environment variable in the hosting provider, not hardcoded** — confirm by reviewing current deployment configuration

---

## Section 6 — Third-party vendors

- [ ] **Subprocessors list is current** — review [subprocessors.md](subprocessors.md) against the list of tools actually in use; update if any have changed
- [ ] **No new vendors were added this quarter without being added to the subprocessors list**
- [ ] **All subprocessors still have active privacy policies and DPAs** — spot-check 2-3 vendors on the list
- [ ] **Stripe Radar and fraud detection settings are reviewed** — Stripe dashboard → Radar → confirm rules are appropriate

---

## Section 7 — Code security

- [ ] **Dependencies have been scanned for known vulnerabilities** — run: `pip audit` (backend) and `npm audit` (web/mobile); review output
- [ ] **No known critical CVEs in current dependency stack** — if found, upgrade immediately or document a mitigation
- [ ] **API input validation is in place on all endpoints** — review Pydantic model constraints in `backend/app/api/` — all required fields have type constraints
- [ ] **No SQL injection risk from raw string queries** — confirm all database queries use parameterized queries or the Supabase ORM
- [ ] **No hardcoded credentials in any source file** — run: `git grep -E "(password|secret|key)\s*=\s*['\"]" -- '*.py' '*.ts' '*.tsx' '*.js'`

---

## Section 8 — Infrastructure security

- [ ] **Supabase network restrictions are configured** — Supabase → Settings → Network → confirm allowed IPs (if applicable)
- [ ] **Supabase Advisor shows zero warnings** — Supabase → Advisors → confirm all checks pass
- [ ] **Hosting provider shows no unaddressed security alerts** — review hosting dashboard security tab
- [ ] **Cloudflare (if in use) has WAF rules enabled** — Cloudflare → Security → confirm WAF is active
- [ ] **No outdated Docker images or base images in use** — if self-hosting n8n or any service, confirm images are updated

---

## Section 9 — Incident readiness

- [ ] **Incident response runbook is current** — review [incident-response.md](incident-response.md) — last reviewed date is within 12 months
- [ ] **Primary on-call contact information is correct** — verify phone/Telegram in the runbook
- [ ] **Escalation contacts are current** — lawyer, backup on-call are up to date
- [ ] **Privacy Commissioner of Canada breach notification process is understood** — founder has read [incident-response.md](incident-response.md) → PIPEDA section
- [ ] **Breach record template is ready** — know where breach records would be filed (Notion, internal doc)

---

## Section 10 — Compliance posture

- [ ] **Privacy policy is current and published** — [privacy-policy.md](privacy-policy.md) is live at swingbyy.com/privacy with correct "Last updated" date
- [ ] **Terms of service are current and published** — live at swingbyy.com/terms
- [ ] **Cookie policy is current** — live at swingbyy.com/cookies with accurate cookie list
- [ ] **PIPEDA compliance checklist has been reviewed this year** — [pipeda-compliance.md](pipeda-compliance.md) last reviewed date is current
- [ ] **No unresolved DSAR requests older than 30 days** — check the DSAR log in [data-handling.md](data-handling.md)
- [ ] **Vulnerability disclosure policy is published** — [vulnerability-disclosure.md](vulnerability-disclosure.md) is live at swingbyy.com/security/disclosure
- [ ] **Subprocessors page is published** — live at swingbyy.com/subprocessors

---

## Audit summary

Complete this section after working through all items above.

| Section | Items checked | Items passed | Issues found |
|---|---|---|---|
| 1. Authentication | | | |
| 2. Data protection | | | |
| 3. Logging | | | |
| 4. Backups | | | |
| 5. Secrets | | | |
| 6. Vendors | | | |
| 7. Code security | | | |
| 8. Infrastructure | | | |
| 9. Incident readiness | | | |
| 10. Compliance | | | |
| **Total** | | | |

**Open issues:**
[List all `[!]` items here with assigned owner and fix deadline]

**Date completed:** _______________  
**Completed by:** _______________  
**Next audit due:** _______________

<!-- graph-wire:start -->
---
**Up:** [[MOC-Trust]] · **Home:** [[SWINGBY]]

**Related:** [[data-handling]] · [[incident-response]] · [[pipeda-compliance]] · [[privacy-policy]] · [[subprocessors]] · [[vulnerability-disclosure]]
<!-- graph-wire:end -->
