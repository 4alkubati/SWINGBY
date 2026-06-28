---
type: month-plan
month: June 2026
phase: 1 — BETA
owner: Kira
tags: [roadmap, june, beta]
---

# JUNE 2026 — Phase 1: BETA (one file)

> Everything for June lives here. Top = the plan you act on (Jun 27–30, with step-by-steps). Bottom = the history log (Jun 18–26, what already shipped). Terms you don't know are in the **📖 Glossary** at the very bottom — don't break flow mid-step.
>
> Master timeline (both lanes): [[DOMINOES]]. Deep build steps per domino: [[dominoes/D2.0-live-walkthrough|dominoes/]]. Live state: [[../AGENTS/claude/memory/STATUS|STATUS.md]]. Only-a-human list: [[../AGENTS/claude/memory/HUMAN-TODO|HUMAN-TODO.md]].

## 🎯 June win condition
A real tester completes a full booking on a real device (Expo Go), with real branded email, sandbox payment. **D1 ✅ · D2 code ✅ — what's left is verification + the D2.x trust/monetization pages + the first human walk-throughs.**

---

# ▶️ ACTIVE PLAN (Jun 27–30)

> Two lanes every day: **you** (left, by hand) and the **overnight LOOP** (right, code). Your tasks have full steps here; the agent's build steps live in the linked domino file.

## Sat Jun 27 — today · clear the 4 gates
**🛌 Overnight LOOP:** D2.5 ✅ done → queues [[dominoes/D2.1-employee-trust-card|D2.1]] for tonight.
**Win when:** all 4 gates below are green so the smoke test + D2.0 can run.

### Your task 1 — Push the D2.5 commit *(Bucket C)*
1. Open Git Bash in the repo root: `cd ~/OneDrive/Desktop/AMR/CODE/Swingby`
2. Stage only the roadmap/docs/memory changes (not `credentials/`):
   ```
   git add Roadmap/ AGENTS/claude/memory/STATUS.md AGENTS/claude/memory/HUMAN-TODO.md \
           AGENTS/claude/PRODUCT-VISION.md CLAUDE.md docs/
   ```
3. Commit: `git commit -m "docs(D2.5): rewrite STATUS to reality, lock D2.4, backfill June, add DOMINOES plan"`
4. Push: `git push origin main`
5. **Verify:** `git status` shows "up to date with origin/main" and GitHub shows the new commit.

### Your task 2 — Stripe keys + 2 products *(Bucket B)*
1. Create/open test account at https://dashboard.stripe.com (toggle **Test mode** ON, top-right).
2. Developers → API keys → reveal `sk_test_…` → paste into Render env as `STRIPE_SECRET_KEY`.
3. Developers → Webhooks → Add endpoint → URL `https://swingbyy-api.onrender.com/payments/stripe/webhook` → events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_succeeded`, `invoice.payment_failed` → reveal `whsec_…` → Render env `STRIPE_WEBHOOK_SECRET`.
4. Products → Add product (×2, recurring/month CAD): **Solo $30** and **Team $80**. Copy each price ID → Render env `STRIPE_PRICE_SOLO` and `STRIPE_PRICE_TEAM`.
5. **Verify:** Render shows 4 Stripe env vars; redeploy is triggered by the push from task 1.

### Your task 3 — DMARC TXT *(Bucket B, 1 record)*
1. Cloudflare → swingbyy.com → DNS → Add record.
2. Type `TXT` · Name `_dmarc` · Content `v=DMARC1; p=none;` → Save.
3. **Verify:** the record shows in the DNS list (effect is invisible day-of; it just keeps mail out of spam).

### Your task 4 — 3 seed accounts *(Bucket B)*
1. Supabase → Authentication → Users → **Add user** (×3).
2. Use the emails + passwords from [[../credentials/test-accounts/seed-accounts|credentials/test-accounts/seed-accounts.md]] (`client@`, `business@`, `employee@swingby.app`).
3. **Tick "Auto Confirm User"** on each so they skip email verification.
4. **Verify:** `auth.users` lists all 3; the smoke test will now authenticate instead of 401.

---

## Sun Jun 28 — D2.0 walk-through (you) ‖ D2.1 employee card (loop)
**🛌 Overnight LOOP:** [[dominoes/D2.1-employee-trust-card|D2.1]] — employee trust card parity + `/employees/{id}/stats` endpoint (build steps in the domino file).
**Win when:** every screen tapped once on a real phone, bugs filed.

### Your task — Live walk-through on iPhone (~1 hr)
1. Follow the full step-by-step in [[dominoes/D2.0-live-walkthrough|D2.0]] (warm Render → Expo Go QR → walk auth → client → business → shared buckets).
2. File every bug, dead button, and confusing screen under the **## D2.0 — Walk-through bugs** heading near the bottom of this file (add it when you start).
3. **Verify:** D2.0 done-rule met — every bucket visited, bug list written (even if "0 bugs").

---

## Mon Jun 29 — triage (you) ‖ D2.2 invoices (loop)
**🛌 Overnight LOOP:** [[dominoes/D2.2-invoices|D2.2]] — in-app receipt + downloadable PDF (reportlab). Build steps in the domino file.
**Win when:** D2.0 bugs are sorted into fix-now vs later.

### Your task — Triage the D2.0 bug list
1. Open the **D2.0 — Walk-through bugs** list you filed yesterday.
2. Tag each: 🔴 blocker (breaks the beta flow) · 🟡 polish · ⚪ later.
3. For each 🔴, add a one-line sub-domino (what + which file) so the loop can pick it up.
4. **Verify:** every blocker has an owner (loop or you) and a next action.

---

## Tue Jun 30 — verify (you) ‖ D2.3 + D2.4 backend (loop)
**🛌 Overnight LOOP:** [[dominoes/D2.3-offplatform-pay|D2.3]] mark-as-paid + [[dominoes/D2.4-business-subscription|D2.4]] backend start (migration + Stripe products + subscribe endpoint).
**Win when:** D2.1 + D2.2 confirmed working on your phone.

### Your task — Quick on-device verify of D2.1 + D2.2
1. Reload Expo Go. Open an employee profile → confirm rating, completed-jobs count, photo render (D2.1).
2. Open a completed booking → tap the receipt → confirm the in-app receipt shows + the PDF downloads (D2.2).
3. **Verify:** both render real data with no crash; note any gap under the bug list.

---

# 📓 HISTORY LOG (Jun 18–26 — append-only, do not edit)

### Thu Jun 18 — infrastructure (last pure-scaffolding day)
OS setup day: pro email plan (Cloudflare receive + Resend send), morning-debrief upgrade. Mentor note flagged: after this, the machine must drop beta dominoes, not more scaffolding.

### Fri Jun 19 — email + debrief
Pro email `@swingbyy.com` wired (Cloudflare Email Routing inbound → Gmail; Gmail "Send mail as" via Resend SMTP `smtp.resend.com:587`). One merged SPF record + Resend DKIM + Cloudflare MX. n8n Compile Brief upgraded to read the day's file.

### Sat Jun 20 — finish the OS
Email send+receive proven. n8n morning **and** night brief reading the daily file (fixed with `N8N_RESTRICT_FILE_ACCESS_TO=/data`). OS launcher workflow (Execute Sub-workflow per automation). STATUS updated. Email ✅.

### Sun Jun 21 — infrastructure / catch-up
No sprint domino. LOOP ran but stayed on the post-launch site (Home rewrite, HowItWorks split, CSP fix) + auth honesty (cascade FK migration, forgot-password redirect, contact endpoint). Commits `40c03d1`, `74acaa0`.

### Mon Jun 22 — (no daily entry)
Carried by the Jun 21 infra work / Jun 23 reorg prep. No standalone shipped artifact logged.

### Tue Jun 23 — mobile bucket reorg
41 mobile screens moved flat → 9 buckets (admin, auth, business, client, flows, messages, onboarding, profile, shared). 5 importer files patched. Expo web export green. Commit `938799e`. Lesson: mass `git mv` + regex import patch + navigator update is one atomic pass.

### Wed Jun 24 — trust layer + Stripe sandbox
Supabase migration `booking_events_and_photos` applied (RLS, 0 new advisors). Backend `booking_events.py` + `booking_photos.py` + `payments_stripe.py` + `stripe_service.py`. Mobile `LiveStatusTimeline`, `LiveStatusActions`, `BookingPhotos` + Pay-with-card. Smoke script `smoke_e2e.py` ready. Commits `554453b`, `2ac90b3`.

### Thu Jun 25 — frozen on Kira
LOOP runs 15–23 re-hammered the same state because STATUS.md lied (claimed 4 fixes + CHECK bug uncommitted; they'd shipped in `214fdb6` + `340e537`). No new code. **Lesson (promoted to the learning log): don't trust STATUS.md without `git log` + `git status` — the working tree is the truth.** Triggered the D2.5 cleanup.

### Fri Jun 26 — DOMINOES plan created
Interview pass with Claude. Verified D1 ✅, D2 code ✅. Scoped sub-dominoes D2.0→D2.5 + D3/D4/D5. All domino files + index + `_LEARNING-LOG` written (book convention). D2.4 NEEDS-KIRA ×3 surfaced.

### Sat Jun 27 — D2.5 cleanup + D2.4 unblocked
STATUS rewritten to git truth; HUMAN-TODO rewritten; D2.4 ×3 answered + locked (track-only beta · Solo $30/Team $80 · accept-gate at `active|trialing`); June daily files backfilled. Roadmap restructured into this single June file + the July folder.

---

# 📖 GLOSSARY — flip here if curious (don't read mid-step)

**Domino** — one small, ordered step toward beta. Each has its own file under `dominoes/` with steps + an append-only log.
**LOOP / overnight LOOP** — the autonomous agent run (`run-overnight.sh`) that builds while you sleep; stops at NEEDS-KIRA.
**Bucket A/B/C** — A = agent just does it · B = parked for you (key, toggle, account) · C = hard-stop (deploy, delete, spend, send).
**Render** — the cloud host running the FastAPI backend at `swingbyy-api.onrender.com`.
**Expo Go** — the iPhone app that runs the SwingBy mobile build from a QR code, no App Store needed.
**Smoke test** — `backend/scripts/smoke_e2e.py`, walks the whole booking chain end-to-end to prove the server works.
**Seed accounts** — the test client/business/employee logins the smoke test + walk-throughs use.
**DMARC** — a DNS TXT record that tells inboxes your mail is legit, so it doesn't land in spam.
**Escrow** — payment held until the job's done, then auto-released; the trust feature. Only works on in-app card.
**Platform cut** — SwingBy's 10% on in-app card payments. Cash/e-transfer = record-only, no cut.
