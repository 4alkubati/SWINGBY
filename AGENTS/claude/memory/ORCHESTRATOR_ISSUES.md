---
name: orchestrator-issues
description: Open SwingBy bugs and gaps — live tracker (resolved history in memory/archive/)
metadata:
  type: project
---

# SwingBy — Orchestrator Issue Tracker (open items only)

> **Re-verified against code 2026-07-17 (overnight orchestrator, grep-proofed).** Deleted as resolved: C5+H6 (`/businesses/me/analytics` exists businesses.py:223, screen calls it), C7 (HomeScreen.js:117 + NearbyMapScreen.js:395 call `/businesses/nearby`), C8 (Dashboard on 4 real APIs), C9 (Chat 5s polling live), H1 (Maps key rotated, app.json uses env placeholder, repo private), H4 (Resend live — booking email landed in Kira's inbox 2026-07-16), H5 (Earnings calls `/payments/mine`), H7 (EmployeeManagement fully wired: create/deactivate/reactivate/list), H10 (Notifications built from real `/bookings/` + `/service-posts/my`).
> Full audit incl. resolved/fixed tables: `memory/archive/ORCHESTRATOR_ISSUES-2026-06-audit.md`.
> Rule: when an item resolves, delete its row here (history lives in the archive + SESSION_LOG). Never read the archive at startup.

## CRITICAL — blocking core flows

(none — all June CRITICALs resolved or reclassified; C4/C6 moved to LOW: they only serve unshipped web-launch pages)

## HIGH — before public launch

| ID | Layer | Issue |
|---|---|---|
| H2 | Auth | Rotate temporary admin password |
| H3 | Auth | Enable HaveIBeenPwned leaked-password protection — **re-confirmed OFF by Supabase security advisor 2026-07-17** (1 toggle in dashboard, Kira) |
| H8 | Mobile | Stripe payment — code + keys live; on-device Checkout verify pending (Bucket B) |
| H9 | Mobile | ReferralScreen no backend (0 api calls in screen, 0 referral routes) — build or hide the screen for beta |

## LOW — web-launch surface (site not deployed to users yet)

| ID | Layer | Issue |
|---|---|---|
| C4 | Backend | `/api-keys` CRUD missing (web ApiKeys.jsx 404s) |
| C6 | Backend | `POST /webhooks` missing (BusinessIntegrations.jsx) |

## LOW — hygiene (found 2026-07-17 walkthrough)

| ID | Layer | Issue |
|---|---|---|
| L13 | Backend | `GET /messages/interest/{id}` payload has no participant-name field — ChatScreen header self-heal on interest threads can only fall back to post_title (moot while all callers pass otherPartyName) |
| L14 | DB | Supabase advisor WARNs: `update_disputes_updated_at` fn has mutable search_path (one-line migration); `job-photos` public bucket allows listing (decide: acceptable for MVP or tighten SELECT policy) |
| L15 | Docs/Brand | Sender identity split: RESEND_FROM_EMAIL defaults `hello@swingbyy.com` (live email confirms hello@), but invoices footer + CLAUDE.md say `team@swingbyy.com` — pick one address, update copy + docs |

## MEDIUM / LOW

Open M-rows (M3–M10, M12–M17) and L-rows (L1–L12): see the archive file — none are dispatch-blocking. Pull a row back into this file when it gets scheduled.

## Design parity (wireframe)

D1 accent decision (orange vs purple), D2–D6, D8–D10 polish items: archive file. Revisit at beta-polish phase.
