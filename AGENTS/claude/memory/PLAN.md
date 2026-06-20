# PLAN.md — Active Plan

> Written by Orchestrator. Every task framed through DISPATCH_GATE Layer 1 (5W+H) before it lands here.

## Project: SwingBy
## Repo: C:/Users/amrba/OneDrive/Desktop/AMR/CODE/Swingby

## Goal: BETA — a real tester installs the app, signs up, does a real booking, gets a real email. Payment in sandbox.

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
| Status | 🔶 waiting on you — create Resend account, verify swingby.ca domain, paste RESEND_API_KEY + RESEND_FROM_EMAIL into Render env vars |

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
| Obstacle train | [START] → real Google Maps key in EAS secrets