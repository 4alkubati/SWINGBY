# MESSAGE_BUS — Inter-Agent Communication

> Append-only. Newest at the bottom. Orchestrator reads the last 20 every cycle and routes them.
> **Live bus holds OPEN items only.** At session close, roll RESOLVED/ACKED entries into `memory/archive/MESSAGE_BUS-<year>.md`.
> Only the Orchestrator routes. Subagents only see what's routed TO them.

## Message schema

```
---
ID: <ULID-or-timestamp>
FROM: <agent-name>
TO: <agent-name | orchestrator | broadcast>
TYPE: <REQUEST | RESPONSE | BLOCKED | ESCALATE | BROADCAST | DONE>
REF: <related ID / task ID / empty>
PRIORITY: <CRITICAL | HIGH | NORMAL | LOW>
TIMESTAMP: <ISO-8601>
SUBJECT: <one line ≤80 chars>
BODY:
  GOAL:
  INPUTS:
  CONSTRAINTS:
  ACCEPTANCE:
STATUS: <OPEN | ACKED | RESOLVED>
---
```

## Bus

> Drained 2026-07-17 (overnight session): 20260617-0003 (invite card — never dispatched, superseded by D4 tester kit, spec kept in deliverables) and 20260623-0001 (mobile reorg DONE — ACKed, all NEXT_AGENT asks closed) rolled to `archive/MESSAGE_BUS-2026.md`.

---
ID: 20260717-1001
FROM: orchestrator
TO: design-agent
TYPE: REQUEST
REF: PLAN.md Tonight #1 (SPEC-1)
PRIORITY: HIGH
TIMESTAMP: 2026-07-17T04:55:00Z
SUBJECT: Write the 31-screen execution spec from the mock atlas (spec only, no code)
REVIEW (orchestrator, 2026-07-17): APPROVED — deliverables/design-exec-spec-2026-07-18.md (1019 lines) spot-checked: all 31 target files covered (32 mock frames — BusinessProfile has 2 view-states), 63 tagged items (2 P0 · 26 P1 · 35 P2, counts mechanically verified), mockPresence.js boundary defined, implementation waves included, "exceeds mock" rule protects existing state handling. ⚠ Product call flagged before dispatch: entry #26 — the "Job Management" mock is a lead-triage feed that matches DashboardScreen's existing lead feed, NOT JobManagementScreen.js (a per-booking status screen). No code touched (verified via git status).
BODY:
  GOAL: One deliverable that lets mobile/frontend agents implement the Jet × Pulse mock atlas without re-opening the HTML.
  INPUTS:
    - design/handoff-mocks-2026-07-17/swingby-mocks-standalone.html (31 screens, each labeled with its target file)
    - design/handoff-mocks-2026-07-17/README.md (rules: reference only, never copy HTML/CSS)
    - mobile/src/theme/tokens.js + typography.js (canonical tokens)
    - mobile/src/screens/** (current implementations)
  CONSTRAINTS:
    - Spec document ONLY — no production code edits.
    - Per screen: target file, gap list (mock vs current), priority P0/P1/P2, token additions if any.
    - Data the app can't provide (online presence, read receipts): specify a clearly-marked mock service boundary.
    - Recreate-in-RN rule: spec describes RN components/tokens, never HTML/CSS to copy.
  ACCEPTANCE:
    - AGENTS/claude/deliverables/design-exec-spec-2026-07-18.md covers all 31 labeled screens.
    - Each screen entry is implementable standalone (file path + concrete change list).
    - Priority buckets present; mock-data callouts marked.
  MCPs ALLOWED: none needed (local files); WebSearch for RN component docs only.
  DEADLINE: tonight (before 06:05 brief)
STATUS: RESOLVED
---

---
ID: 20260717-1002
FROM: orchestrator
TO: mobile-agent
TYPE: REQUEST
REF: PLAN.md Tonight #2+#3 (FIX-1, FIX-2)
PRIORITY: HIGH
TIMESTAMP: 2026-07-17T04:55:00Z
SUBJECT: PostJob wizard SafeArea + chat header identity (two small fixes)
REVIEW (orchestrator, 2026-07-17): APPROVED — diffs read directly. insets.top pad matches sibling-screen idiom; headerName self-heal mirrors MessageThreadScreen lens; /bookings/{id} route confirmed (bookings.py:208); all 8 Chat callers already passed otherPartyName. Gates: babel 115/0 + App.js OK (docker node:20), flow graph 0 broken, no RN SafeAreaView. Flag for backend backlog: /messages/interest/{id} payload has no participant name field.
BODY:
  GOAL: Kill the two visible UI bugs from Kira's 2026-07-16 evening screenshots.
  INPUTS:
    - FIX-1: mobile/src/screens/client/PostJobScreen.js — step tabs (CATEGORY/DETAILS/BUDGET/CONFIRM) render under the status-bar clock.
    - FIX-2: mobile/src/screens/messages/ChatScreen.js:328/345/386 — header falls back to "Chat" + "C" avatar when route.params.otherPartyName is missing; find every navigate('Chat') caller and pass otherPartyName; add an in-screen fallback deriving the name from threadInfo / the booking fetch.
  CONSTRAINTS:
    - SafeArea via react-native-safe-area-context only (no RN SafeAreaView import).
    - No backend changes; no navigation-structure changes.
    - Any new user-facing string: i18n key in EN + fr-CA + ar in mobile/src/i18n.js (flat keys, NUL separator is configured — see i18n.js:329 comment).
    - Do not touch the booking-loop API calls.
  ACCEPTANCE:
    - Babel parse of all mobile/src + App.js via docker (node:20) → 0 errors.
    - Grep: every navigate('Chat'|'MessageThread') caller passes otherPartyName OR the screen derives it.
    - No SafeAreaView imported from 'react-native' anywhere in mobile/src.
  MCPs ALLOWED: none.
  DEADLINE: tonight (before 06:05 brief)
STATUS: RESOLVED
---

---
ID: 20260717-1003
FROM: orchestrator
TO: qa-agent
TYPE: REQUEST
REF: PLAN.md Tonight #4 (QA-1) — depends on 20260717-1002
PRIORITY: NORMAL
TIMESTAMP: 2026-07-17T04:55:00Z
SUBJECT: Regression pass after tonight's mobile fixes
RESULT (qa-agent, 2026-07-17): 5/5 PASS — diff limited to the 2 expected files; babel 115/0 (docker node:20); flow graph 0 broken/0 orphans/0 broken API; all grep gates green; send/poll paths untouched. Orchestrator ACKED.
BODY:
  GOAL: Prove tonight's UI fixes broke nothing.
  INPUTS:
    - Diff of mobile/src from FIX-1/FIX-2 (git status/diff)
  CONSTRAINTS:
    - Read-only on code; file breaks to memory/HUMAN-TODO.md with repro, do not fix.
    - No prod smoke (nothing pushed tonight).
  ACCEPTANCE:
    - Babel parse full mobile/src + App.js via docker node:20 → 0 errors.
    - python3 tools/flow_graph.py regen → 0 broken edges / 0 orphans / 0 broken API.
    - Grep gates from 20260717-1002 verified; RESPONSE on the bus with results.
  MCPs ALLOWED: none.
  DEADLINE: tonight (after mobile-agent completes)
STATUS: RESOLVED
---
