# Skill: verification-before-completion

> Borrowed from Superpowers. "Done" means proven, not hoped.

## The rule
No task is marked DONE on a guess. Before claiming completion, the agent must **show evidence**:
- Ran the code / test → paste the actual output.
- Checked every acceptance criterion in the task → tick each one.
- Confirmed nothing adjacent broke.

## Banned phrases
- "This should work."
- "It's probably fine."
- "Done." (with no proof attached)

## Format for a DONE message
```
DONE: <what shipped, file paths>
PROOF: <command run + actual output / screenshot / test result>
ACCEPTANCE: <each criterion → ✅ with evidence>
```

## Why this fits Kira
He can't debug, so a false "done" costs him a whole overnight cycle to discover. Verification up front means breakage is caught by the agent, not by a beta tester.

---
*Part of [[_SKILLS]] · the accept-gate at [[DISPATCH_GATE]] Layer 6.*
