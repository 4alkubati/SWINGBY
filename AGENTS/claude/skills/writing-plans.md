# Skill: writing-plans

> Borrowed from Superpowers. Turns the obstacle train into something an agent can't get lost in.

## The standard
A plan is good when an **enthusiastic junior with no context, no taste, and an aversion to testing** could follow it without a single decision of their own.

## Every task in a plan has:
- **Exact file path** — `mobile/screens/HomeScreen.js`, not "the home screen."
- **The complete change** — the actual code or the exact edit, not "wire it up."
- **A verification step** — how to prove this one task worked before moving on.
- **Size: 2–5 minutes of work.** If it's bigger, split it. Small tasks = small blast radius = easy to verify = no fleeing.

## Why this fits Kira
He directs agents (who improvise badly) and can't debug (so ambiguity is expensive). A plan this concrete removes both problems: the agent has nothing to invent, and every step self-checks.

## Anti-patterns
- "Refactor the auth flow" → too big, no path, no check. Trash.
- "Make it work" → not a task.
- Tasks with no verification → you won't know it's done until it breaks in front of a user.

---
*Part of [[_SKILLS]] · powers [[DISPATCH_GATE]] Layer 2 (obstacle train) + Layer 3 (plan).*
