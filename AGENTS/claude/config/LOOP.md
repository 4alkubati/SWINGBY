# LOOP — autonomous build loop (the engine)

> Turns the kit from "run one task" into "run the plan by itself." Runs hands-off, parks what only Kira can do, and STOPS before it can hurt anything. Kira reviews a batched list, never a live yes/no marathon.
> Default mode: AUTONOMOUS + GATED (below). Pairs with `DISPATCH_GATE.md` (every task still passes the 7 layers) and the skills.

## Startup (read once, in order — use PATH-INDEX so you never search)
1. `../PRODUCT-VISION.md` — what we're building + your role slice (read ONLY your slice).
2. `config/PATH-INDEX.md` — where every file is. Never grep the repo for paths.
3. `memory/STATUS.md`, `memory/PLAN.md`, last `SESSION_LOG.md`, `memory/HUMAN-TODO.md`.
4. If `PLAN.md` has no active phased plan → orchestrator drafts one from PRODUCT-VISION (phases + per-task done-rules), then start the loop.

## The loop
```
while the plan has runnable tasks and not ALL-DONE:
    task = next task whose dependencies are met
    classify task into ONE bucket:

    ── Bucket A: JUST DO IT (normal build work) ──
        run it (DISPATCH_GATE + skills) → check its DONE-RULE (verification-before-completion)
        pass  → mark DONE, append SESSION_LOG, next task
        fail  → retry with systematic-debugging, up to RETRY_CAP (default 3)
        still fail → write to HUMAN-TODO as BLOCKED + mark task blocked → skip, keep going on others

    ── Bucket B: PARK IT (human-only) ──
        if the task needs Kira (API key, dashboard toggle, account creation,
        copy/brand approval, anything secret) →
        write it to memory/HUMAN-TODO.md with the exact action, mark task WAITING-ON-HUMAN,
        and CONTINUE to the next runnable task. Do NOT stop the whole loop.

    ── Bucket C: HARD STOP (never auto) ──
        if the task would DELETE data, deploy to PROD, spend money / move funds,
        send a public message, or change access/permissions →
        STOP that branch, write NEEDS-KIRA to HUMAN-TODO + STATUS with what + why. Never do it autonomously.

    at a PHASE boundary → write a one-paragraph checkpoint to SESSION_LOG (for the morning brief)

when no runnable tasks remain:
    if all done → write ALL-TASKS-COMPLETE to STATUS
    else        → write WAITING-ON-HUMAN to STATUS (everything left is in HUMAN-TODO)
```

## The three buckets (the rule that keeps it safe)
| Bucket | Example | Behaviour |
|---|---|---|
| **A — Just do it** | write an endpoint, wire a screen, run a test | autonomous, no pause |
| **B — Park to HUMAN-TODO** | paste a key, flip a Supabase toggle, approve copy, make an account | log it, keep working on everything else |
| **C — Hard stop** | delete data, deploy prod, spend money, send public msg, change permissions | halt that branch, NEEDS-KIRA, never auto |

## Rules
- **Every task has a DONE-RULE** before it runs. No done-rule = not ready, send back to planning.
- **RETRY_CAP = 3** (configurable). A loop can never run forever.
- **Never pause for routine work.** The only interruptions are Bucket B (parked, non-blocking) and Bucket C (hard stop).
- **Pre-digest for Kira:** when something blocks, write *what broke / why / the exact next action* — she decides, never debugs.
- **Loop Training Mode** (optional, default OFF): ON = pause for approval at each step. Use ONLY to watch a risky new loop closely; normal operation is the autonomous+gated mode above.

## What Kira sees (not a yes/no marathon)
- `memory/HUMAN-TODO.md` — the short batched list of "only you can do this," surfaced in the morning brief.
- Phase checkpoints in `SESSION_LOG.md`.
- She clears the list in minutes; the agent already did everything around it.


---
*[[MAP]] · enforced by [[ORCHESTRATOR]] · uses [[DISPATCH_GATE]] + [[_SKILLS]] · reads [[PRODUCT-VISION]] + [[PATH-INDEX]] · parks to [[HUMAN-TODO]]*
