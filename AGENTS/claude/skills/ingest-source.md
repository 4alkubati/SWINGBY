# Skill: ingest-source

> Borrowed from Austin Marchese's "6 Skills." Turns a raw source into compacted, reusable knowledge — so the system reads once and remembers, instead of re-reading everything every time.

## When it triggers
You hand the agent a source: a URL, a doc, a repo, a transcript, or a brain-dump of ideas. Or the loop needs to refresh PRODUCT-VISION from new input.

## The move
1. Read the full source.
2. **Extract only what's reusable** — facts, decisions, specs, constraints. Drop fluff.
3. **Compact + role-slice it:** write it where it belongs — `PRODUCT-VISION.md` (the build), a reference file, or a skill. Tag which role needs it (backend / mobile / design / FOH).
4. Link it from the relevant memory/config so future runs find it via PATH-INDEX, not a re-read.

## Why it fits Kira
His ideas are scattered (chat, marketing/, his head). Ingest-source is how "read all my ideas → compact for the agent" actually happens — once — so every future loop starts smart instead of re-reading the world (and burning tokens).

## Guardrail
One source → one compacted home. Don't duplicate. If it updates an existing doc, edit that doc, don't create a second copy.

---
*Part of [[_SKILLS]] · feeds [[DISPATCH_GATE]] Layer 1 + keeps PRODUCT-VISION current.*
