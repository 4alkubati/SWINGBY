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
