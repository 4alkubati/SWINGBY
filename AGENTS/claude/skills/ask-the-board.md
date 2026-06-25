# Skill: ask-the-board

> Borrowed from Austin Marchese's "6 Skills." A panel of expert personas reviews the work before it's accepted — catches what one reviewer misses. This is the biggest single lever on engineering + design quality.

## When it triggers
Before accepting any high-stakes work: a new feature, a schema change, an auth/payment flow, a screen design, an architecture decision. (Routine tasks just use two-stage-review.)

## The board (4 personas — each critiques in its lane)
1. **Senior Engineer** — correctness, edge cases, error handling, simplicity. "What breaks at 2am?"
2. **Security Reviewer** — auth, RLS, secrets, injection, data exposure. "How is this abused?"
3. **Product Designer** — UX, clarity, professional feel, accessibility. "Would a real user get this instantly?"
4. **Product Manager** — does it serve the goal + the user, or is it scope creep? "Does this move us to beta?"

## The move
1. Present the work to all 4 personas.
2. Each returns: **APPROVE / NEEDS-WORK / REJECT** + one concrete reason.
3. Tally: all approve → ship · any NEEDS-WORK → fix those specific points first · any REJECT → back to design.
4. The orchestrator pre-digests the board's notes for Kira: *what to change and why* — she decides, she doesn't debate.

## Why it fits Kira
She can't personally code-review or design-review. The board is her senior team — it raises the floor on every piece so the output looks like a real company built it, not a solo founder rushing.

---
*Part of [[_SKILLS]] · runs at [[DISPATCH_GATE]] Layer 6 for high-stakes work · upgrades [[two-stage-review]].*
