# FIX — closing the loop

## Picking work

```
python tools/bugctl.py next
```

It only hands out findings that are `confirmed` **and** have a verify step. If it
returns nothing under READY TO FIX, the VERIFY pass has not been run. Go run it
rather than picking something at random — fixing an unverified finding is how you
spend an hour on a bug that was already fixed.

Fix worst-first within what is ready. A `sloppy` finding in a file you are
already editing for a `blocker` gets fixed in the same pass — that is free.

## The loop, per finding

```
1. bugctl show SB-0007            — read the evidence and the verify step
2. read the named files           — the finding may be stale in its details
3. make the change
4. run the verify step            — the literal one in the finding
5. run the smoke test if the change touches the booking loop
6. bugctl close SB-0007 --verified --commit HEAD --note "<what changed>"
7. bugctl render > docs/bugs/LEDGER.md
```

Step 4 is not optional and step 6 asserts you did it. `--verified` is a claim.

## The booking-loop guard

Any change touching `backend/app/api/` or a mobile screen in the
post→quote→accept→booking→complete loop is **not done** until:

```
python tools/e2e_smoke.py
```

passes against a locally running backend. This is DISPATCH_GATE Layer 6 and it
is mandatory. It verifies response *shapes*, not just routes — the flow graph
cannot catch payload drift; this does.

Backend must be up:

```
cd backend && python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

`backend/.env` has an empty `SECRET_KEY` — export one or it will not boot.

## Test costs on this box

- **Mobile jest:** one file at a time with `-w 2` (5–25s). The full suite takes
  2.4h and is effectively unusable. Never run it as a verify step.
- **Backend pytest:** fine. From a worktree it needs dummy env vars — the venv
  and `.env` live only in the primary tree.

## Money changes

Before changing anything that moves money, confirm the caller list with `grep -rn`,
not `graphify affected`. The graph under-reports module-qualified calls and has
already caused a half-shipped fix: `compute_completion_release_cents` shows 2
callers in the graph and 3 under grep, and the missed one carried the identical bug.

`backend/app/services/escrow.py` is the authority for every figure. If a fix
changes a number a user sees, the matching copy in
`mobile/src/screens/shared/TermsOfServiceScreen.js` changes in the same commit —
that text is what the client agreed to.

## Fix it, don't hand back a to-do list

No "most impactful remaining work" endings. If a finding is confirmed, small, and
you are in the file, fix it and close it. The reason the ledger exists is that
findings were being reported instead of resolved.

The honest exceptions, each of which gets stated plainly rather than buried:

- The fix needs a product decision (SB-0009: require photos, or just surface
  "no proof submitted"?). Say what the options are, recommend one, wait.
- The fix needs a key, an account, or a deploy you cannot do.
- The fix is large enough that it should be its own dispatch. Say how large.

In every one of those cases, finish every *other* finding you picked up before
saying so.

## Wontfix

A deliberate decision, never a shrug:

```
python tools/bugctl.py edit SB-0004 --status wontfix
python tools/bugctl.py note SB-0004 "two exits is intentional — Done confirms, back cancels"
```

A `wontfix` with no note is indistinguishable from an abandoned finding, and the
next scan will refile it.

## After a fix session

```
python tools/bugctl.py render > docs/bugs/LEDGER.md
python tools/bugctl.py stats
git add docs/bugs/ && git commit
```

Commit the ledger with the fix, not separately. A bug closed in the same commit
as its fix means `git log docs/bugs/ledger.jsonl` reads as a real changelog, and
`git blame` on a reopened bug points straight at the commit that claimed it.
