# Skill: learning-loop

> Borrowed from Hermes (Nous Research). The system gets smarter every cycle instead of starting cold.

## The idea
A self-improving agent doesn't just finish tasks — it *captures what it learned* so the next run is faster and better. This is the closed loop: do → learn → encode → reuse.

## When it triggers
At the close of any complex or non-trivial task (Layer 7 of the gate).

## The four moves
1. **Capture a skill.** If a reusable pattern emerged ("here's the right way to wire a screen to an API"), write it as a new file in `claude/skills/` so every future agent inherits it.
2. **Improve a skill.** If an existing skill was wrong or a better way was found, edit that skill file. Skills sharpen with use.
3. **Log the lesson.** Append a one-line "what we learned" to [[SESSION_LOG]] and update [[STATUS]] if it changes the picture.
4. **Nudge to persist.** If the same lesson shows up twice and isn't yet a skill, the orchestrator flags: "this should be a skill." Don't let knowledge stay trapped in one session.

## Why this fits Kira
He's running this system for months. Without a learning loop, every overnight run repeats the same mistakes and he re-explains the same things. With it, the kit compounds — agents he barely supervises get more reliable on their own. That directly grows his leverage while he sleeps.

## Guardrail
Don't over-generate skills. One skill per *genuinely reusable* lesson. A skills folder full of near-duplicates is noise — periodically consolidate (merge overlapping skills).

---
*Part of [[_SKILLS]] · closes [[DISPATCH_GATE]] Layer 7 · maintained by [[ORCHESTRATOR]].*
