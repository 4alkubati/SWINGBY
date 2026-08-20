## What changed, and why

<!-- The change is visible in the diff; the REASON is not. Write the reason. -->

## How it was verified

<!-- The specific command or check you ran, and its result. "Tested locally" is
     not a verification — `pytest -q` -> 1337 passed is. -->

- [ ] Backend suite run (`cd backend && pytest -q`) if backend/ changed
- [ ] `tools/e2e_smoke.py` run if the booking loop changed (DISPATCH_GATE Layer 6)
- [ ] `python3 tools/gen_api_docs.py --check` clean if a route was added/renamed
- [ ] Migration filed under `supabase/migrations/` if the schema changed

## Bug ledger

<!-- Fixing a filed finding? Name it, so `bugctl close` can point at this commit.
     Finding something new? File it: `python3 tools/bugctl.py add ...`.
     A finding not in the ledger did not happen. -->

Closes: SB-____

## Risk

<!-- What breaks if this is wrong, and how it would be noticed. Say "none" only
     if you have thought about it. -->
