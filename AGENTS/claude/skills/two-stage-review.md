# Skill: two-stage-review

> Borrowed from Superpowers. Upgrades the orchestrator's single review into two passes.

## When it triggers
Every time an agent reports a task DONE. The orchestrator reviews in two separate stages — never collapse them.

## Stage 1 — Spec compliance
Does it do **exactly what the task asked**? Check against the task's 5W+H and acceptance criteria. Nothing more, nothing less.
- Missing a requirement → reject, back to the agent.
- Did extra stuff not asked for → flag it (scope creep is debt).

## Stage 2 — Code quality (only if Stage 1 passes)
Is it *good*? No hardcoded secrets, errors handled, no debug junk, no obvious security/RLS gap, readable. For [[_FOH]] work: on-message, accurate, nothing sent without approval.

## Decision
- Both pass → accept → log to [[SESSION_LOG]].
- Either fails → bounce with a one-line reason. No item left in limbo.

## Why two stages
A single review blurs "does it work?" with "is it clean?" and lets half-right work slip through. Splitting them catches more before it ever reaches Kira.

---
*Part of [[_SKILLS]] · run by [[ORCHESTRATOR]] at [[DISPATCH_GATE]] Layer 6.*
