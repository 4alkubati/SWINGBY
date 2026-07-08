# Skill: systematic-debugging

> Borrowed from Superpowers. This is the answer to "I direct agents but can't debug."
> When code breaks, the agent runs this — and the orchestrator pre-digests the result for Kira.

## When it triggers
Any time a build fails, a test fails, or output is wrong. No guessing, no random changes.

## The 4 phases (in order — never skip)

1. **Reproduce.** Make the bug happen on demand. If you can't reproduce it, you can't fix it. State the exact steps + the exact error.
2. **Isolate (root-cause trace).** Trace backward from the error to the *cause*, not the symptom. Add logging, bisect, narrow until you can point at the one line/condition. Ask: "what's the smallest thing that, if true, explains all of this?"
3. **Fix minimally.** Change the one thing that fixes the root cause. No drive-by edits, no "while I'm here." Smaller fix = easier to verify.
4. **Verify.** Re-run the reproduction. Prove it's fixed. Then check nothing else broke. (Hands off to [[verification-before-completion]].)

## Pre-digest rule (for the orchestrator)
Kira does not read raw errors. The orchestrator translates every break into three lines:
- **What broke** (plain English)
- **Why** (the root cause)
- **Next prompt** (the exact instruction to give the agent)

Kira decides. He never diagnoses.

---
*Part of [[_SKILLS]] · enforced at [[DISPATCH_GATE]] Layer 6 · used by every [[_BOH]] agent.*
