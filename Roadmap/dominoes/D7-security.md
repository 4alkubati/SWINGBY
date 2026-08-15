---
type: domino
id: D7
status: active
phase: 1 — BETA
started: 2026-07-19
done:
links: [[../DOMINOES]]
prev: [[D6-m1-gate]]
next: [[D8-money-uber]]
tags: [domino, security, secrets, monitoring]
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


### 2026-08-02 — reality sync: partial, and honestly so

**No change to status — remains `active`.** A 2026-08-02 markup described D7 as
"deferred to before launch, not partial-now". The second half is not accurate:
work has already been done on two of the three sub-items.

- **D7.1** secret rotation — open. Kira's standing ruling is that rotation waits
  for the pre-beta API sweep; that is a deliberate deferral, not an oversight.
- **D7.2** Supabase advisors — **2 of 3 cleared live.** The outstanding one is
  the HaveIBeenPwned leaked-password toggle, which is dashboard-only and
  Pro-gated. Accepted risk, recorded.
- **D7.3** monitoring — analytics **verified live** (Plausible 202). Sentry
  remains unprovable from this box: no dashboard credentials here.

So D7 is genuinely part-done. Leaving it `active` rather than flipping it to
`deferred` keeps that visible instead of hiding it behind a future date.

## 🎓 Learning

- **"Rotated" and "deleted" are not the same word.** A secret removed from HEAD but present in history is still live until revoked at the source.
- **Instrument claims need an observed event.** The gap between "the SDK is initialised" and "an error arrived in the dashboard" is where false confidence lives.

---

## 🔐 D7.4 – D7.13 — the penetration test findings

*Added 2026-08-14. Filed here, under D7, because D7 is security and a domino id
should tell you what it is about without a lookup.*

**Why they were renumbered.** The engagement shipped its report with `C-01`,
`M-01…M-05` and `L-01…L-04` — one day after PR #148 established that this repo
has exactly one ID scheme. Kira, 2026-08-14: *"idk why we are back into using
other letters, it should all be a domino."* Correct. The crosswalk below keeps
the original report readable; nothing else uses the old ids.

**Tested against** `main @ f2dd461` on prod Render, Supabase, Stripe TEST.
First-party authorized engagement. 1 Critical · 5 Medium · 4 Low · 13 Info.

| Domino | Was | Sev | Finding | Status |
|---|---|---|---|---|
| **D7.4** | C-01 | 🔴 Critical | Refresh-token replay — a spent token still worked 65s after rotation | ✅ fixed 2026-08-14 |
| **D7.5** | M-01 | 🟠 Medium | `redirect_to` allowlist checked scheme, not path — `swingby://../../root` passed | ✅ fixed |
| **D7.6** | M-02 | 🟠 Medium | No rate limit on `POST /messages/` — 110/110 accepted, zero 429s | ✅ fixed |
| **D7.7** | M-03 | 🟠 Medium | Stored unsanitized markup in post titles and message bodies | ✅ fixed — **and a live sink was found, see below** |
| **D7.8** | M-04 | 🟠 Medium | `avatar_url` stored any URL: metadata IP, localhost, `file://`, `gopher://` | ✅ fixed |
| **D7.9** | M-05 | 🟠 Medium | Upload type was client-declared — SVG-as-JPEG and EICAR both stored | ✅ fixed |
| **D7.10** | L-01 | 🔵 Low | `android:allowBackup="true"` | ✅ `false` in app.json — **needs a rebuild to take effect** |
| **D7.11** | L-02 | 🔵 Low | Maps API key ships in the bundle | ⚠️ **Kira only** — verify package+SHA-1 restriction in Google Cloud Console |
| **D7.12** | L-03 | 🔵 Low | 500 instead of 404 on nonexistent-booking sub-resources | ✅ **CLOSED — prod-verified 2026-08-15** |
| **D7.13** | L-04 | 🔵 Low | No documented refresh-token rotation policy | ✅ `docs/SECURITY.md` now carries one |

### What changed, in one place

* **D7.4** — `supabase/migrations/20260814000000_session_revocation.sql`,
  `services/session_security.py`, `api/auth.py`, `deps.py`. Every refresh token
  the API issues and spends is recorded by hash; a replay inside 60s is allowed
  (a client that never persisted the rotated token), outside it is refused and
  revokes the account. A password change stamps `users.sessions_valid_after`
  via a trigger on `auth.users` — the reset runs client-side against Supabase
  and never reaches our backend, so a trigger is the only place that sees it.
* **D7.5** — `auth.py::_validate_redirect`. Scheme gate kept; path must now end
  in `auth-callback`, with no `..`, no backslash, no query, no fragment.
* **D7.6** — `messages.py`, 60/minute. Generous on purpose: real chat is bursty.
* **D7.7** — two layers. `text_safety.scrub` strips executable tags and event
  handlers at write; `api/invoices.py` escapes user values before reportlab.
* **D7.8** — `services/url_safety.py`, https + public host only, on both
  `PATCH /auth/me` and the social sign-in avatar.
* **D7.9** — `services/image_sniff.py`, magic bytes must agree with the header.

### 🎓 What the pentest got wrong, and it is the useful part

The report filed **M-03 as "not proven exploitable today: no render sink
found — no `dangerouslySetInnerHTML`, no `autoescape=False`. React/RN default
escaping holds."**

There is a sink. `api/invoices.py` builds the PDF with reportlab's `Paragraph`,
which does not take plain text — it parses a mini-HTML dialect, which is why
the literal `<b>SwingBy</b>` in that file renders bold. Client names, business
names, categories and role titles were interpolated straight into it. A surname
containing `<` produced a mangled invoice or an unhandled parse error; a value
like `<font size=40>` restyled someone else's receipt.

The search looked for the two sinks a *web* app has. The sink was in a PDF
generator. **"No sink found" is a statement about where you looked.**

### Still owed

- **117 `[PENTEST]` rows in the production database** — 5 messages, 2 service
  posts, 110 `[PENTEST-FLOOD]` messages. All greppable by prefix. Deleting is
  destructive, so it waits for Kira's explicit go-ahead.
- **Rotate the test-account credentials** used across the engagement.
- **D7.11** — Google Cloud Console, Kira only.
- **D7.12** — confirm prod stops serving the 500s once Render redeploys.

### 2026-08-15 — verified against the live system, not against source

Two things stopped being claims today.

**D7.4 — proven end-to-end.** Kira applied
`20260814000000_session_revocation.sql`. The pentest's exact reproduction was
then re-run against a local backend on live Supabase:

| Step | Result | |
|---|---|---|
| login, refresh with `R0` | 200 | normal use, untouched |
| replay `R0` immediately | 200 | grace window — a client that died before persisting the rotated token is not signed out |
| **replay `R0` after 65s** | **401** | **the finding, closed** |
| access token after that replay | 401 | revoked at once, not after the ~1h token life |
| the legitimate rotated `R1` | 401 | whole family revoked |
| log in again | 200 | **not bricked** |
| new session authenticates + refreshes | 200 | the watermark did not orphan it |

Server log, in its own words:
`session.revoked · reason: refresh_token_replay`. `tools/e2e_smoke.py` was re-run
afterwards — **ALL PASS** — confirming the revocation left nothing stuck.

**Before** the migration, the same replay returned **200**. That is the designed
inert state (the lookup fails open when the table is absent), and it is now the
empirical proof of the fail-open claim rather than an assertion about it.

**D7.12 — closed, prod-verified.** All five booking sub-resources plus
`GET /messages/{id}` now answer **404** on `swingbyy-api.onrender.com` for a
nonexistent id, authenticated. Render has redeployed past #146. This row said
"still live in prod" for two days; it was checked rather than assumed stale.

**D7.11 remains the only open pentest item**, and it is console-only.

### 2026-08-15 — D13 no longer needs a Render edit to stop 500ing

`api/subscriptions.py` raised **500** when `STRIPE_PRICE_TEAM` held an unusable
value, as a deliberate fail-fast. The intent was right and the blast radius was
wrong: the variable holds `prod_Un0sRFGpiSHrL9`, all 18 businesses are
team-tier, and so *every* owner who tapped Subscribe got a server error from
either of two screens.

An unusable price id now means "billing is not configured" and takes the
track-only branch that already existed five lines below — flip to `trialing`,
charge nothing — which is the documented beta posture locked 2026-06-27.
`logger.error` still names the variable and the value, so it stays loud for the
operator and silent for the user. 10 tests pin it, including that a valid
`price_...` is not swallowed.

**DEC-7 is still worth answering** — this stops the bleeding, it does not decide
whether billing is on.
