---
name: deepscan
description: Systematic bug sweep for SwingBy that writes into the durable ledger instead of a throwaway report. Use when asked to find bugs, audit a surface, re-verify known findings, work through the bug backlog, or ingest walkthrough screenshots. Runs in three phases — VERIFY (re-check what is already known), SCAN (find what is new), FIX (close the loop). Never produces a to-do list; every run leaves the ledger more accurate than it found it.
---

# deepscan

## Why this exists

The bug-finding was never broken. `~/brain/inbox/SENTINEL-findings.md` holds 900+
lines of well-proven findings with file:line, root cause and fix — and roughly
half are stale, already fixed or fixed-then-rebroken, with no way to tell which
half. Prose findings have no identity, so they cannot be closed, deduped or
re-verified. Every sweep restarts from zero and rediscovers the same five money
bugs.

**A finding that is not in the ledger did not happen.** The ledger is
`docs/bugs/ledger.jsonl`, driven only through `python tools/bugctl.py`. Never
hand-edit the jsonl and never hand-edit `docs/bugs/LEDGER.md` (it is generated).

Read `references/LEDGER.md` for the full field contract before your first write.

## The one rule that makes this work

Every finding carries a **verify** step: the literal command or check that proves
it fixed. `bugctl close` refuses without one. This is what stops the
"I think I already did that one" loop that produced the current backlog.

If you cannot write a verify step for something, it is not a finding yet — it is
a suspicion. File it anyway with the verify field describing the *check that
would settle it*, and let the VERIFY phase resolve it.

## Order of operations — VERIFY before SCAN, always

Running SCAN first is what created the backlog. A scan on top of unverified
findings inflates the pile with duplicates of bugs that are already fixed.

```
VERIFY (cheap, high value)  →  SCAN (expensive)  →  FIX (closes the loop)
```

If the user asks for "a scan" with a stale ledger, do the VERIFY pass first and
say so. `python tools/bugctl.py stale --days 14` tells you how bad it is.

---

## Phase 1 — VERIFY

Re-check known findings against current HEAD. Cheapest phase, and the one that
retires the most work.

```
python tools/bugctl.py stale --days 14      # what nobody has re-checked
python tools/bugctl.py show SB-0007         # the claim, its evidence, its verify step
```

For each: read the named files at current HEAD and decide whether the evidence
still holds. Then record it — this is not optional, an unrecorded verification
is the same as not doing it:

```
python tools/bugctl.py verified SB-0007 --result still-broken
python tools/bugctl.py verified SB-0007 --result gone --note "fixed by 911fd92"
```

`gone` sets status `stale` and keeps the row forever. A stale finding that comes
back is the best regression signal in the system — never delete one.

Full procedure and the judgement calls: `references/VERIFY.md`.

## Phase 2 — SCAN

Bounded, resumable coverage instead of one unbounded burn. The repo is
partitioned into **surfaces** in `references/SURFACES.md` (80 mobile screens,
30 backend API modules, 26 services, 96 web files). Scan one surface per run,
record coverage, resume next session.

Locate with graphify — it is a locator, not an oracle:

```
graphify query "how does escrow release" --budget 1500
graphify affected "compute_completion_release_cents"
```

⚠ `affected` under-reports module-qualified calls and has already cost a
half-shipped money fix. **For anything touching money, confirm the caller list
with `grep -rn` before trusting the graph.**

Before filing anything, check it is not already known:

```
python tools/bugctl.py check "duplicate payments row on accept"
```

Then file, or bulk-import a JSON array from a scan agent:

```
python tools/bugctl.py add --title "..." --severity blocker --area backend \
  --file backend/app/api/interests.py:425 --evidence "..." --verify "..." --fix "..."

python tools/bugctl.py import findings.json --by scan-agent
```

Severity ladder, evidence standard, and the eight defect classes to hunt:
`references/SCAN.md`.

## Phase 3 — FIX

```
python tools/bugctl.py next
```

Only hands out findings that are **confirmed** (re-verified as still broken) and
have a verify step. If it returns nothing, the VERIFY pass has not been run —
go do that rather than picking a bug at random.

For each fix: make the change, run its verify step, run the booking-loop smoke
test if the change touches `backend/app/api/` or any screen in the
post→quote→accept→booking→complete loop, then close:

```
python tools/e2e_smoke.py                    # DISPATCH_GATE Layer 6, mandatory
python tools/bugctl.py close SB-0007 --verified --commit HEAD --note "..."
```

`--verified` is an assertion that you ran the verify step and it passed. Do not
pass it otherwise. `--force` exists for genuine exceptions and should appear in
a commit message when used.

Procedure and the "fix it, don't hand back a to-do list" rule: `references/FIX.md`.

---

## Closing every run

```
python tools/bugctl.py render > docs/bugs/LEDGER.md
python tools/bugctl.py stats
```

Then report to the user in this shape — no wall of text:

```
VERIFIED   n re-checked → n still broken, n went stale
FOUND      n new (n blocker, n broken, n sloppy)
FIXED      SB-0007, SB-0012  (verify passed, smoke passed)
COVERAGE   mobile/screens/business 19/19 · backend/api 12/30
NEXT       the surface to scan next run
```

## Rules

- **Never report a bug you did not file.** If it is worth telling the user, it is
  worth an id.
- **Never file without checking for a duplicate** (`bugctl check`).
- **Never close without running the verify step.**
- **Never delete a finding.** `stale`, `wontfix` and `dupe` are the exits.
- **Fix it, don't hand back a to-do list.** If a finding is small and confirmed
  and you are already in the file, fix it and close it in the same pass.
- Screenshots from a walkthrough live in `~/brain/inbox/debugging/`. Ingest them
  with `--screenshot <path>` so the visual evidence stays attached to the id.
- Findings whose evidence is a screenshot alone enter as `open`, never
  `confirmed` — a screenshot proves a symptom, not a cause.
