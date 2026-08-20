# SURFACES — the coverage partition

"Scan the whole repo" is not a task, it is a wish. This partitions it into
surfaces small enough to scan properly in one run and resume next session.

**One or two surfaces per run.** A surface scanned shallowly is worse than a
surface not scanned, because coverage will claim it is done.

Record coverage in `docs/bugs/COVERAGE.md` after each run: surface, date, commit,
findings filed. A surface goes stale after ~30 commits touching it.

## Mobile — 80 screens

| Surface | Files | Why it matters |
|---|---|---|
| `mobile/src/screens/client` | 22 | The demand side. Post→browse→accept. Most walkthrough bugs land here. |
| `mobile/src/screens/business` | 19 | The supply side. Dashboard, jobs, earnings, profile. SB-0002/3/6/7 live here. |
| `mobile/src/screens/profile` | 10 | Settings, language, referrals, account. SB-0008. |
| `mobile/src/screens/shared` | 7 | Terms, legal, booking details. **Copy here is contractual.** |
| `mobile/src/screens/messages` | 6 | Quote threads + booking chat. Block enforcement, moderation. SB-0001. |
| `mobile/src/screens/admin` | 6 | Report queue, moderation. Guideline 1.2 surface. |
| `mobile/src/screens/onboarding` | 4 | Signup→category→location. Feeds everything downstream. |
| `mobile/src/screens/flows` | 3 | Cancellation, dispute. **Money + policy copy.** |
| `mobile/src/screens/auth` | 3 | Login, signup, deep-link auth. |
| `mobile/src/i18n.js` | 1 | 4 locales. Cross-check every user-facing number against escrow.py. |
| `mobile/src/services` | — | `acceptAndPay.js`, `auth.js`, `authLink.js`. Money + session. |

## Backend — 30 API modules, 26 services

| Surface | Why it matters |
|---|---|
| `backend/app/services/escrow.py` + `budget_settlement.py` | **The authority on every figure.** Scan first, scan often. |
| `backend/app/api/payments*.py`, `services/stripe*.py` | Capture, refund, Connect, webhook idempotency. |
| `backend/app/api/bookings.py` | Largest module. Confirm, complete, cancel, dispute. |
| `backend/app/api/interests.py`, `service_posts.py` | Quote→accept. The two-payments-rows class lives here. |
| `backend/app/services/approvals.py`, `expiry_sweep.py` | Time-triggered money. Check every sweep **has a caller**. |
| `backend/app/api/auth.py` | Sessions, rate limits, password reset. |
| `backend/app/api/messages.py`, `services/visibility.py`, `content_moderation.py` | Blocks enforced symmetrically; `hidden_at` on every read path. |
| `backend/app/api/proof_of_work.py` | Before/after photos, approval. SB-0009. |
| `backend/app/api/admin.py`, `services/moderation.py` | Admin guards, sweeps. |
| `backend/app/api/businesses.py`, `reviews.py` | Geo-browse, ratings. SB-0005. |

## Web — 96 files

| Surface | Why it matters |
|---|---|
| `web/launch/src` | 40+ routes, i18n EN/FR/AR, analytics. Public claims live here. |
| `web/pre-launch`, `workers/waitlist` | Deployed. Waitlist writes. |
| `web/admin` | **Not deployed** — low priority; admin review is in-app. |

## Cross-cutting passes

These cut across surfaces and are worth their own run:

1. **Money copy audit.** Every user-facing number in the app and on the site vs
   `escrow.py`. Cancellation windows, platform cut, release timing, referral
   credit. This class has shipped wrong twice.
2. **Uncalled code.** For each service function: `grep -rn "<name>" backend/app`
   excluding tests. A definition with no caller is either dead or a bug.
3. **Duplicate implementations.** Grep a concept, expect one owner, find two.
   Raw SQL vs Python is the recurring shape.
4. **Read-path filters.** Every query over `messages`, `reviews`,
   `service_posts`, `booking_photos` filters `hidden_at is null` and applies
   `blocked_pair_ids`.
5. **i18n completeness.** Every key in `en` exists in `fr`, `ar`, `uk` and vice
   versa. SB-0007 is what the gap looks like in production.
6. **Orphan screens.** `docs/FLOW_GRAPH.md` is the authority — read it rather
   than scanning navigation by hand.

## Suggested order for a cold start

1. Money copy audit (cross-cutting) — cheapest path to blockers
2. `services/escrow.py` + `budget_settlement.py` + `approvals.py`
3. `api/interests.py` + `api/service_posts.py` + `api/bookings.py`
4. `screens/business` then `screens/client` — where the walkthrough bugs are
5. `screens/flows` + `screens/shared` — contractual copy
6. Uncalled-code pass
7. Everything else
