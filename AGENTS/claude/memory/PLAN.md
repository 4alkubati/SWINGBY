# PLAN.md — Active Plan

> Written by Orchestrator. Every task framed through DISPATCH_GATE Layer 1 (5W+H) before it lands here.

## Project: SwingBy
## Repo: C:/Users/amrba/OneDrive/Desktop/AMR/CODE/Swingby

## Goal: BETA — a real tester installs the app, signs up, does a real booking, gets a real email. Payment in sandbox.

---

## ⚡ OVERNIGHT JOB (2026-06-21 → 2026-06-22) — RUN THIS FIRST

**Brief:** `AGENTS/BRIEF-post-launch-site.md`

**Win condition:** `web/launch` rebuilt into a polished post-launch marketing site (better than `web/pre-launch`). Two How-It-Works flows (clients + businesses), app-mockup placeholders, payment + post + find-job visuals, vite 5→8 vuln fix, lighthouse mobile ≥ 90 perf / 100 a11y, zero `coming soon` lies. Deliverable to `claude/deliverables/post-launch-site-2026-06-22.md`.

**Safeguards:** debug every line (read → edit → re-read → build/lint gate); auto-compact at 128k context (write SESSION_LOG checkpoint, summarize, continue); exit on NEEDS-KIRA — never spin.

**Status:** 🟢 code work done 2026-06-21 (vite 8 prior session, plus this session: HowItWorksBusinesses created, Home rewritten honest, CSP fixed, build/lint/audit green, deliverable written). **Remaining = Kira-only**: export 11 mobile screenshots into `web/launch/public/screenshots/`, supply Calgary photo, run Lighthouse on `/` (perf ≥ 90 / a11y = 100). See `claude/deliverables/post-launch-site-2026-06-22.md`.

---

## TOMORROW — lock-in plan (open this at your evening block, just execute)

**Win condition for the day:** Domino 1 DONE (a real signup email actually sends) + Domino 2 STARTED (mock data being killed). If both happen, you shipped real beta progress.

**Morning (6:10 + coffee):**
1. Read the morning brief on your phone (build status + waitlist).
2. Confirm Resend domain = Verified → paste RESEND_API_KEY into the SwingBy backend env. (2 min — unblocks D1.)
3. Networking block: send 5 beta-tester recruiting messages (have marketing-agent draft, you send).

**Evening lock-in (7:15–9:45 — the real work, no planning):**
4. D1 finish: agent already wired Resend; send yourself a test signup → confirm the email lands. ✅ D1 done.
5. D2 start: dispatch mobile-agent to wire Home/Nearby (C7) to the real API. Watch the first task; if clean, let it continue to Dashboard (C8) + Chat (C9).
6. Close: update STATUS.md, frame tomorrow's task (D2 finish or D3 build).

**Night:** launch run-overnight.sh on whatever D2 didn't finish. PC awake, Docker running.

---

### The 4 dominoes (in order — each unblocks the next)

#### D1 — Email actually sends
| Field | Value |
|---|---|
| 5W+H | WHO beta testers · WHAT signup/notify emails arrive · WHEN domino 1 · WHERE backend + Resend · WHY silent email = dead beta · HOW configure Resend + verify domain + set RESEND_API_KEY |
| Track | BOH | Agent | backend-agent |
| Obstacle train | [START] → create Resend acct + verify swingby domain → set RESEND_API_KEY in Render → wire send calls (signup, booking) → test: real signup email lands → [DONE] |
| What Kira does | Create Resend account, verify domain, paste API key |
| What the agent does | Wire the send helper + call sites, test delivery |
| Status | 🔶 waiting on you — create Resend account, verify swingbyy.com domain, paste RESEND_API_KEY + RESEND_FROM_EMAIL into Render env vars |

#### D2 — Kill the mock data
| Field | Value |
|---|---|
| 5W+H | WHO testers · WHAT Home/Dashboard/Chat show real data · WHEN after D1 · WHERE mobile/ · WHY fake screens = fake beta · HOW wire to real endpoints (C7/C8/C9) |
| Track | BOH | Agent | mobile-agent |
| Obstacle train | [START] → verify endpoints return data → wire Home/Nearby → wire Dashboard → wire Chat polling → loading/empty/error states → [DONE] |
| What Kira does | Approve, test on device |
| What the agent does | Replace mock arrays with real fetches + states |
| Status | ⬜ pending |

#### D3 — A build a tester can install
| Field | Value |
|---|---|
| 5W+H | WHO testers · WHAT installable build · WHEN after D2 · WHERE EAS → TestFlight/Play internal · WHY they need it on a real phone · HOW eas build + real Maps key |
| Track | BOH | Agent | mobile-agent + Kira (store accounts) |
| Obstacle train | [START] → real Google Maps key in EAS secrets → eas build (ios+android) → upload to TestFlight + Play internal → seed accounts log in on device → [DONE] |
| What Kira does | Apple/Google accounts, paste Maps key, invite testers |
| What the agent does | Configure EAS, run builds, document install steps |
| Status | ⬜ pending |

#### D4 — One real end-to-end run
| Field | Value |
|---|---|
| 5W+H | WHO a real tester · WHAT full flow works on a phone · WHEN after D3 · WHERE live app · WHY proof it works for a stranger · HOW post→quote→accept→complete→review, payment in sandbox |
| Track | BOH | Agent | qa-agent |
| Obstacle train | [START] → tester signs up → posts/browses → quote → accept → complete → review → email confirms → [DONE: BETA LIVE] |
| What Kira does | Recruit 1–3 testers, run it with them |
| What the agent does | Smoke-test the flow first, file any breakage |
| Status | ⬜ pending |

---

### FOH (runs in parallel — fill the waitlist + recruit testers)
| Task | Agent | Status |
|---|---|---|
| Draft beta-tester recruiting message + 5 outreach targets | marketing-agent | ⬜ pending |
| Daily morning brief (build + inbox + social) | assistant-agent | ⬜ pending |

### Parked (capture, don't chase — revisit after beta is moving)
- Self-host **Umami** (free, Docker, next to n8n) for site-visitor analytics → wire into the morning brief. Only once actively driving traffic; ~15 min when needed.
