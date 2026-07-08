---
name: orchestrator-issues
description: Open SwingBy bugs and gaps — live tracker (resolved history in memory/archive/)
metadata:
  type: project
---

# SwingBy — Orchestrator Issue Tracker (open items only)

> **Statuses are from the 2026-06-15 cross-platform audit.** Sessions since (trust layer 06-24, D2.1 06-28, business-flow 07-03) likely resolved several — verify against `STATUS.md` + the code before dispatching any row.
> Full audit incl. resolved/fixed tables: `memory/archive/ORCHESTRATOR_ISSUES-2026-06-audit.md`.
> Rule: when an item resolves, delete its row here (history lives in the archive + SESSION_LOG). Never read the archive at startup.

## CRITICAL — blocking core flows

| ID | Layer | Issue | Note |
|---|---|---|---|
| C4 | Backend | `/api-keys` CRUD missing (web ApiKeys.jsx 404s) | |
| C5 | Backend | `GET /businesses/me/analytics` missing | blocks H6/M13 |
| C6 | Backend | `POST /webhooks` missing (BusinessIntegrations.jsx) | |
| C7 | Mobile | HomeScreen browse/nearby not wired to `/businesses/nearby` | verify — HomeScreen touched since |
| C8 | Mobile | Business Dashboard placeholder data | likely fixed 07-03 (WS-E/WS-F) — verify |
| C9 | Mobile | Chat polling not implemented | likely fixed 07-03 (WS-C threads) — verify |

## HIGH — before public launch

| ID | Layer | Issue |
|---|---|---|
| H1 | Mobile | Google Maps key plaintext in app.json → EAS secret |
| H2 | Auth | Rotate temporary admin password |
| H3 | Auth | Enable HaveIBeenPwned leaked-password protection |
| H4 | Email | Resend account/domain/env (code shipped 06-18; account = HUMAN-TODO) |
| H5 | Mobile | EarningsScreen placeholder data — likely fixed 07-03 (WS-E), verify |
| H6 | Mobile | BusinessAnalyticsScreen mock charts (blocked on C5) |
| H7 | Mobile | EmployeeManagement create/deactivate not wired |
| H8 | Mobile | Stripe payment — hosted-Checkout scaffold shipped 06-24; keys + on-device verify pending |
| H9 | Mobile | ReferralScreen no backend |
| H10 | Mobile | Notifications screens no real push data |

## MEDIUM / LOW

Open M-rows (M3–M10, M12–M17) and L-rows (L1–L12): see the archive file — none are dispatch-blocking. Pull a row back into this file when it gets scheduled.

## Design parity (wireframe)

D1 accent decision (orange vs purple), D2–D6, D8–D10 polish items: archive file. Revisit at beta-polish phase.
