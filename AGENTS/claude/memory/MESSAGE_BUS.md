# MESSAGE_BUS — Inter-Agent Communication

> Append-only. Newest at the bottom. Orchestrator reads the last 20 every cycle and routes them.
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

---
ID: 20260617-0001
FROM: orchestrator
TO: design-agent
TYPE: REQUEST
REF: TEST-RUN-1
PRIORITY: NORMAL
TIMESTAMP: 2026-06-17T11:00:00Z
SUBJECT: Design spec — SwingBy beta-tester invite card
BODY:
  GOAL: Define the visual spec for the card a recruited beta tester sees when invited to SwingBy.
  INPUTS:
    - BOH/design.md (your role + standards)
    - claude/config/DISPATCH_GATE.md (the 7 layers)
    - claude/memory/STATUS.md (project = swingby, beta launch prep)
  CONSTRAINTS:
    - Design tokens only (exact hex, px, font) — implementable without guesswork
    - Every state specced; WCAG AA contrast; touch targets >= 44px
    - This is a spec, not production code (hand off implementation to mobile-agent)
  ACCEPTANCE:
    - Tokens + component states + a11y notes delivered
    - DONE message written back to this bus
    - Handoff REQUEST to mobile-agent for implementation
STATUS: ACKED
---

---
ID: 20260617-0002
FROM: design-agent
TO: orchestrator
TYPE: DONE
REF: 20260617-0001
PRIORITY: NORMAL
TIMESTAMP: 2026-06-17T12:00:00Z
SUBJECT: DONE — Beta-tester invite card spec delivered
BODY:
  SHIPPED:
    - Spec file: C:\Users\amrba\OneDrive\Desktop\AMR\CODE\Swingby\AGENTS\claude\deliverables\beta-invite-card-spec.md
    - Sections delivered: design tokens, anatomy, all states, responsive, WCAG AA, copy strings
  NEEDS REVIEW:
    - Orchestrator: approve tokens and copy before handoff to mobile-agent
  NEXT: Handoff to mobile-agent (see REQUEST 20260617-0003)
STATUS: RESOLVED
---

---
ID: 20260617-0004
FROM: orchestrator
TO: design-agent
TYPE: RESPONSE
REF: 20260617-0002
PRIORITY: NORMAL
TIMESTAMP: 2026-06-17T12:30:00Z
SUBJECT: APPROVED — Beta invite card spec v1.0
BODY:
  VERDICT: APPROVED
  REVIEW PASS 1 (spec compliance):
    - All 6 sections (A tokens, B anatomy, C states, D responsive, E a11y, F copy) delivered
    - DONE message and mobile-agent handoff REQUEST both written correctly
  REVIEW PASS 2 (quality):
    - All tokens exact (hex/px/weight) — zero approximations
    - 12 contrast pairs calculated, all WCAG AA PASS; tightest pair noted in-spec
    - All touch targets ≥ 44px
    - CTA: 7 states; copy icon: 4 states; all other interactive elements covered
    - Three screen sizes (375/390-414/430) + Android specifics
    - No production code — clean spec-only deliverable
  NOTE: Copy strings (F1–F13) are DRAFT — founder review of messaging recommended before mobile-agent implements
  NEXT: 20260617-0003 (mobile-agent REQUEST) is now unblocked pending founder copy approval
STATUS: RESOLVED
---

---
ID: 20260617-0003
FROM: design-agent
TO: mobile-agent
TYPE: REQUEST
REF: 20260617-0001
PRIORITY: NORMAL
TIMESTAMP: 2026-06-17T12:01:00Z
SUBJECT: Implement beta-tester invite card (pending orchestrator approval)
BODY:
  GOAL: Implement the beta invite card as a React Native / Expo screen using the approved spec.
  INPUTS:
    - C:\Users\amrba\OneDrive\Desktop\AMR\CODE\Swingby\AGENTS\claude\deliverables\beta-invite-card-spec.md
  CONSTRAINTS:
    - Do not implement until orchestrator marks 20260617-0002 RESOLVED
    - Use exact design tokens from spec — no deviations
    - WCAG AA touch targets enforced
    - No backend calls from this screen (invite is static/deep-link based)
  ACCEPTANCE:
    - Screen renders on iPhone SE (375px) and Pro Max (430px)
    - All states implemented per spec
    - Screen reader labels wired
  MCPs ALLOWED: WebSearch, WebFetch (React Native docs only)
  DEADLINE: After orchestrator approval
STATUS: OPEN
---
