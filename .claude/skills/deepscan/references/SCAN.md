# SCAN — finding what is new

## The evidence standard

A finding is a **claim about what the code does**, not an impression. The bar is
the one `SENTINEL-findings.md` already meets at its best, and it has three parts:

1. **Symptom** — what the user sees, or what breaks, in one sentence.
2. **Proof** — the file:line and the actual expression, quoted. Not "the handler
   looks wrong" but `` `line 425 payment_res = supabase.table("payments").insert(...)`
   runs for every accept, with no Flow A/B branch ``.
3. **Consequence** — what state the system ends in. "Two payments rows share one
   booking_id, and `load_single_payment()` calls `.single()`, so the booking can
   never be completed."

If you cannot write part 2, you have a suspicion. File it, but say so in the
evidence field — `NOT YET CONFIRMED IN CODE` — and keep severity honest.

## Severity ladder

| | Meaning | Test |
|---|---|---|
| `blocker` | Money is wrong, data is lost, auth is bypassable, or a core flow dead-ends | Would you ship a beta with this? No. |
| `broken` | A feature does not do what its UI says it does | A tester files a bug report about it |
| `sloppy` | Correct but visibly unfinished — truncated copy, contradictory labels | A tester notices but works around it |
| `polish` | Nobody would file it, but it is wrong | You would fix it while in the file anyway |

Money bugs are `blocker` even when rare. Copy that misstates a policy the user
agreed to (cancellation windows, escrow terms) is `blocker`, not `sloppy` — that
text is a contract.

## The eight classes to hunt

Ordered by how much they have actually cost this repo:

1. **Two implementations that disagree.** The single most productive class here.
   The raw-SQL expiry cron vs `expiry_sweep.py`; `compute_completion_release_cents`
   vs `settle_on_complete`. Hunt: grep for a concept, expect one owner, find two.
2. **Written but never called.** `grep -rn "<func>" backend/app` excluding tests
   returning only the definition. `settle_on_date_confirmed` sat unit-tested and
   uncalled while money released wrong.
3. **Copy that outruns the code.** UI promises something unimplemented — the
   charge-at-post claim, the 24h vs 48h cancellation window, the referral credit.
   Cross-check every user-facing number against `services/escrow.py`.
4. **Recomputed instead of consumed.** A screen re-deriving a total the backend
   already computed safely, dropping the backend's guard. `EarningsScreen.js`
   resurrecting the phantom-dollars bug this way.
5. **Two screens reading different fields for one fact.** Client sees CONFIRMED,
   business is still asked to propose a time (SB-0006).
6. **A guard that is not symmetric.** Blocks enforced one way; a filter applied
   on one read path and missed on a new one. Every read over `messages`,
   `reviews`, `service_posts`, `booking_photos` needs `hidden_at is null`.
7. **Error swallowed as success.** `except` that toasts "Submitted", a catch that
   logs and continues past a failed refund.
8. **State that only self-heals on read.** Correct when someone looks, wrong when
   nobody does. Fine if a sweep backs it up; a bug if the sweep has no caller.

## Using graphify

```
graphify update .                                   # ~60s, no LLM, zero tokens
graphify query "how does escrow release" --budget 1500
graphify god-nodes --top 10                         # where to look first
graphify affected "release_escrow_on_complete"      # reverse impact
graphify path "PostJobScreen" "release_escrow_on_complete"
```

It returns nodes with file:line, not prose. Use it to decide **what to read**,
then read only those files.

⚠ `affected` under-reports module-qualified calls. It returns 2 callers for
`compute_completion_release_cents`; `grep -rn` returns 3, and the missed one
(`api/proof_of_work.py:302`) carried the identical money bug. **For anything
touching money, confirm the caller list with grep before trusting the graph.**

Rebuild after any significant merge — a stale graph points at moved lines.

## Filing

Always check first:

```
python tools/bugctl.py check "duplicate payments row on accept"
```

Then either one at a time:

```
python tools/bugctl.py add \
  --title "Accept-interest creates two payments rows for one booking" \
  --severity blocker --area backend \
  --file backend/app/api/interests.py:425 \
  --file backend/app/api/interests.py:473 \
  --evidence "line 425 inserts unconditionally for every accept; line 473 then rebinds the pre-existing post_payment row to the same booking_id. load_single_payment() calls .single(), which errors on two matches." \
  --repro "Post a job under Flow A, accept a quote, then GET /payments/{booking_id}" \
  --verify "SQL: select booking_id, count(*) from payments group by 1 having count(*) > 1 — expect zero rows. Then tools/e2e_smoke.py through accept." \
  --fix "When post_payment exists, update it in place instead of inserting a second row."
```

or in bulk from a scan agent, as a JSON array of
`{title, severity, area, files[], evidence, repro, verify, fix, screenshot}`:

```
python tools/bugctl.py import findings.json --by scan-agent
```

Import dedupes by fingerprint automatically and prints what it skipped.

## Writing a good verify step

The test: **could a different session, six weeks from now, run this and know?**

| Bad | Good |
|---|---|
| "Check the payment logic" | `select booking_id, count(*) from payments group by 1 having count(*)>1` — expect zero |
| "Make sure the label is right" | Open Settings→Language after setting uk then en, relaunch; badge and sheet checkmark must agree |
| "Run the tests" | `cd backend && pytest tests/test_escrow_ledger.py -q` |

Mobile: one jest file at a time with `-w 2` — the full suite takes 2.4h on this
box and is unusable. Backend pytest from a worktree needs dummy env vars; the
venv and `.env` live only in the primary tree, and `backend/.env` has an empty
`SECRET_KEY`.
