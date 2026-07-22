---
group: plan
project: swingby
hub: "[[MOC-Plan]]"
tags: [plan, domino, security, secrets, monitoring]
type: domino
id: D7
status: active
phase: 1 — BETA
started: 2026-07-19
done:
links: [[../DOMINOES]]
prev: [[D6-m1-gate]]
next: [[D8-money-uber]]
---

# 🁢 D7 — Security + honest instruments

> Index: [[../DOMINOES|DOMINOES]] · Prev: [[D6-m1-gate|D6]] · Next: [[D8-money-uber|D8]] · Master log: [[_LEARNING-LOG]]

## 🎯 Goal

No live secret is one that leaked. Zero open Supabase advisors. And every monitoring claim is *proven* by an observed event, not by the existence of code.

## 🤔 Why this matters

The repo was public. Secrets committed during that window are compromised until rotated — deleting them does nothing. And a launch checklist that says "monitoring is live" without anyone having seen an event arrive is worse than no checklist: it converts an unknown into a false certainty. One line already claimed "RLS 0 advisor warnings ✅" while three advisors were open.

## ✅ Pre-reqs

- [ ] None. Runs in parallel with [[D6-m1-gate|D6]].

---

## 🪜 D7.1 — Secret rotation *(Kira generates, agent verifies)*

An agent cannot generate a secret. It can wire and it can prove the old one is dead.

### Step 1 — Telegram bot token
@BotFather → `/mybots` → pick the bot → **API Token** → **Revoke current token** → copy the new one into `.claude/secrets/n8n.env` as `TELEGRAM_BOT_TOKEN=` *(gitignored, never committed)*.
> **Verify:** the old token returns unauthorized; the 06:05 brief still delivers on the new one.

### Step 2 — test credentials
The `.dev` accounts were exposed while the repo was public. Supabase → Authentication → Users → reset passwords for `testclient@swingby.dev` and `testbusiness@swingby.dev`. `CLAUDE.md` is committed, so either use a password you're fine having in the repo, or move the block to a gitignored note.
> **Verify:** `git grep` finds no live secret anywhere in the tree.

**Done-rule:** old token unauthorized, bot works on the new one, nothing sensitive in `git grep`, and exposure is neutralized by rotation — not by deletion and hope.

## 🪜 D7.2 — Supabase advisors to zero

Two of three cleared live on 2026-07-19: the `update_disputes_updated_at` search_path is pinned, and public listing on the `job-photos` bucket is closed (public object download untouched). Two docs that falsely claimed "0 advisor warnings" were corrected.

**Outstanding — Kira only, 1 minute:** enable HaveIBeenPwned leaked-password protection.
https://supabase.com/dashboard/project/ulnxapnsenzyddddldjt/auth/providers → **Email** provider → Password section → **Leaked password protection** → ON → Save.

Agents genuinely cannot do this one: it is Auth platform config, not database. No SQL surface exists and the MCP server has no auth-config tool. *If the toggle is greyed out it needs a Pro-plan project — stop and re-scope the checklist item rather than forcing it.*

> **Done-rule:** `get_advisors` returns zero warnings and the checklist states what is actually true.

## 🪜 D7.3 — Monitoring proven, not assumed

**Analytics: done.** Plausible is keyless; a real test event was fired at the live ingest API for `swingbyy.com` and accepted (HTTP 202). The three-event funnel — signup, booking created, booking completed — is wired and all three were confirmed received.

**Backend Sentry: blocked, honestly.** No Render dashboard/API credentials and no Sentry credentials exist anywhere on this box — checked shell env, `.claude/secrets/`, repo history. An admin-gated `GET /admin/monitoring-probe` that throws a real uncaught exception on demand is committed and ready on `card-07-monitoring`.

**Proven set in prod** by hard evidence: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SECRET_KEY` — the app hard-fails at import if any is missing, and prod is live and DB-connected. `SENTRY_DSN` presence is genuinely **unknown**; it is optional and has no observable external effect.

**Flagged:** `mobile/.env.production` is committed and tracked, and already contains a real `EXPO_PUBLIC_SENTRY_DSN` from commit `5c51dd0` — contradicting the long-standing note that mobile Sentry is unset.

> **Done-rule:** the probe fires and the error is visible in the Sentry dashboard — link or screenshot in the log. "Code exists" is not done.

## 🏁 Done-rule (the whole domino)

Old secrets are dead, advisors read zero, and both a test error and a test analytics event have been *seen* in their dashboards.

---

## 📖 Log (append-only)

### 2026-07-19 — converted from cards
- Absorbed CARD-05 (D7.1), CARD-06 (D7.2), CARD-07 (D7.3).
- CARD-06 worked in an isolated worktree and cleared 2 advisors live, verified before and after via `get_advisors`.
- CARD-07 reported Sentry as unprovable rather than assuming it. Correct: the card's own rule was "if you lack access, do not guess."

## 🎓 Learning

- **"Rotated" and "deleted" are not the same word.** A secret removed from HEAD but present in history is still live until revoked at the source.
- **Instrument claims need an observed event.** The gap between "the SDK is initialised" and "an error arrived in the dashboard" is where false confidence lives.

<!-- graph-wire:start -->
---
**Up:** [[MOC-Plan]] · **Home:** [[SWINGBY]]

**Related:** [[2026-07-19]] · [[CLAUDE]] · [[D6-m1-gate]] · [[D8-money-uber]] · [[_LEARNING-LOG]]
<!-- graph-wire:end -->
