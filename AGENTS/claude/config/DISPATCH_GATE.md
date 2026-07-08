# DISPATCH GATE — The 7 Layers

> Every task, every agent, every time. No task is dispatched until it has passed Layers 1–3.
> No work is accepted back until it has passed Layers 5–6.
> This is the spine of the whole system. The Orchestrator enforces it. Nothing skips it.

The kitchen rule: **BOH** (Back of House) = technical, hidden — backend, frontend, mobile, design.
**FOH** (Front of House) = the image the customer sees — marketing, PR, your inbox.
Customers never see the kitchen. They see the plate. Both run in parallel.

---

## LAYER 1 — Frame it (5W+H)

Before anything moves, the task is written as 5W+H. If you can't fill all six, the task isn't ready — it's a wish.

| | Question | Example (SwingBy mobile) |
|---|---|---|
| WHO | Who does this serve / who runs it? | Beta testers / mobile-agent |
| WHAT | The one concrete outcome | Home screen shows real nearby businesses |
| WHEN | Deadline + when it runs | Overnight Sat, reviewed Sun 9am |
| WHERE | Which file / surface / repo | mobile/screens/HomeScreen.js |
| WHY | Why it matters to the goal | Mock data = fake beta = no real signal |
| HOW | The method, one line | Replace mock array with GET /businesses/nearby |

**Gate:** all six filled → proceed. Any blank → stop and fill it.

---

## LAYER 2 — The obstacle train

List every blocker between "now" and "done" as **stations on one line**. The train must pass each in order — you can't skip a station. This kills the "I'll just move on when it gets hard" reflex, because the next station is always named.

```
[START] → station 1 → station 2 → station 3 → [DONE]
```

Example:
```
[START] → API endpoint returns data? (verify) → wire fetch in screen
        → handle loading/empty/error states → test on device → [DONE: real data on Home]
```

**Gate:** every station is a small, checkable step. If a station feels like a cliff, split it into two smaller stations until each one looks easy. (Hard-as-doable rule.)

---

## LAYER 3 — Read memory, write the plan

The agent reads, in order: `memory/STATUS.md`, `memory/PLAN.md`, last 3 of `memory/SESSION_LOG.md`, open items in `memory/MESSAGE_BUS.md`. Then it writes a 3-part plan back:

```
WHAT I (KIRA) DO:   <the human-only steps — accounts, keys, approvals, decisions>
WHAT THE AGENT DOES: <the overnight build work, station by station>
WHY:                <one sentence tying it to the goal>
```

**Gate:** plan names exactly what needs *you* vs. what the agent handles alone. No overlap, no gaps.

---

## LAYER 4 — You prep, then let it run

You do only the human-only steps from Layer 3 (the things an agent literally cannot do: create an account, paste an API key, approve a decision). Then you launch the parallel run and sleep:

- **BOH agents** build overnight (backend / frontend / mobile / design).
- **FOH agents** run overnight too (marketing drafts, PR, inbox triage prep).

**Gate:** before sleep, every agent has a REQUEST on the bus with full Layer 1–3 context. Nothing starts half-briefed.

---

## LAYER 5 — Two outputs, two times of day

The system reports to you in two distinct briefs so you're never reading a wall of text:

**BOH — Night Build Summary** (ready when you wake / reviewed in your evening block):
```
DONE:        <what shipped, with file paths>
NEEDS YOU:   <the human-only steps blocking the next station>
WHY:         <why those steps matter now>
NEXT:        <the next station once you unblock it>
```

**FOH — Morning Image Brief** (n8n runs it while you make coffee):
```
SOCIAL:      <yesterday's analytics — reach, signups, waitlist adds>
INBOX:       <emails needing a reply + a drafted professional response each>
OUTREACH:    <today's networking targets + the message to send>
```

**Gate:** both briefs are skimmable in under 2 minutes. If longer, the agent compressed badly — send it back.

---

## LAYER 6 — Review and execute

You read the two briefs, approve or reject, and do the human-only steps. This is your real bottleneck (you direct, you don't debug) — so the Orchestrator pre-digests: it tells you *what broke, why, and the exact next prompt to give the agent.* You execute, you don't diagnose.

**Gate:** every DONE item is either accepted (→ SESSION_LOG) or bounced back with a one-line reason. No item left in limbo.

---

## LAYER 7 — Plan the next ride

Before closing, write tomorrow's top task through Layer 1 again (5W+H) and drop it in `PLAN.md` as the next dispatch. The system always wakes up knowing its first move — you never start a day "figuring out what to do."

**Gate:** `PLAN.md` has a fully-framed next task. `STATUS.md` is rewritten. Then, and only then, the cycle closes.

---

## The loop, in one line

`Frame (5W+H) → Train the obstacles → Read memory & plan → Prep + run overnight (BOH ∥ FOH) → Two briefs → Review & execute → Frame the next.`

Repeat daily. The system carries the memory so you carry only the decisions.

---

## Skills wired into the gate (see claude/skills/ · [[_SKILLS]])

Mandatory, not optional. The orchestrator checks for the relevant skill before acting.

- **Layer 1 (Frame):** run [[brainstorming]] — tease the spec out in small chunks before filling 5W+H.
- **Layer 2–3 (Train + Plan):** write it with [[writing-plans]] rigor — exact file paths, the complete change, a verification step per station, 2–5 min each.
- **Layer 6 (Review):** [[two-stage-review]] (spec compliance, then code quality). When anything breaks, [[systematic-debugging]] (4-phase root cause). Accept only via [[verification-before-completion]].
- **Layer 6 (booking-loop guard):** any change touching `backend/app/api/` or a mobile screen in the post→quote→accept→booking→complete loop is NOT accepted until `python tools/e2e_smoke.py` passes against a locally running backend. It verifies response *shapes*, not just routes — the flow graph can't catch payload drift; this does.
- **Layer 7 (Next):** run [[learning-loop]] — capture or improve a skill from what was learned, log the lesson. The system gets smarter every cycle.

## Quality skills wired (from the 6-skills method)
- **Layer 1:** [[ingest-source]] — when given a source/idea, compact it into PRODUCT-VISION/reference (don't re-read raw every run).
- **Layer 6 (high-stakes only — features, schema, auth/payment, screens, architecture):** run [[ask-the-board]] (4-persona expert review) AND, for user-facing work, [[internal-focus-group]] (simulate Calgary tradesperson + homeowner) before marking DONE. Routine tasks stay on two-stage-review.
