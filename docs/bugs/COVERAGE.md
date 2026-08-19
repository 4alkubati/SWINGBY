# Scan coverage

What has actually been swept, when, and against which commit. Without this,
"we scanned the repo" is unfalsifiable and every session re-scans the same
three files.

Append one row per `deepscan` SCAN run. Surfaces are defined in
`.claude/skills/deepscan/references/SURFACES.md`.

A surface goes stale after roughly 30 commits touching it.

| Date | Surface | Commit | Filed | Notes |
|---|---|---|---|---|
| 2026-08-19 | walkthrough screenshots (Img1–Img7) | fd5c063 | SB-0001…SB-0010 | Ingest only, not a code scan. All entered `open` — a screenshot proves a symptom, not a cause. |
| 2026-08-19 | VERIFY: SB-0007, SB-0008 (i18n) | cf7e79f | — | Both **confirmed still broken**, neither stale. SB-0008 fixed in `5021c6d`; SB-0007 left open pending a product call. |

## Not yet scanned

Everything else. The suggested cold-start order is at the bottom of
`SURFACES.md`; the short version is money first:

1. Money copy audit (cross-cutting)
2. `services/escrow.py` + `budget_settlement.py` + `approvals.py`
3. `api/interests.py` + `api/service_posts.py` + `api/bookings.py`
4. `screens/business` + `screens/client`

## Backlog not yet in the ledger

`~/brain/inbox/SENTINEL-findings.md` — ~40 findings, ~929 lines, no ids, no
status, no verify steps, believed ~half stale. Migration procedure is in
`references/LEDGER.md`. Until it is migrated, it is a log, not a queue: triage
before dispatching anything from it.
