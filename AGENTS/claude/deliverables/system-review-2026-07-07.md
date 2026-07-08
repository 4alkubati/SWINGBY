# System Review — 2026-07-07 (AGENTS · structure · Notion · tokens · Ollama)

> Kira asked: less text, agents that verifiably run, folder structure, Notion health,
> token optimization, Ollama. Findings first, fixes second, decisions last.

---

## 1 · AGENTS folder — does an agent run actually work?

**Verdict: the docs describe a dispatch system that cannot execute as written.**

| Finding | Evidence | Severity |
|---|---|---|
| No agent definitions registered | `.claude/agents/` does not exist. ORCHESTRATOR Step 4 dispatches `subagent_type: backend-agent` etc. — none of those types exist, the Agent tool call fails | **CRITICAL** |
| Stale model IDs | ORCHESTRATOR names `claude-opus-4-6`, `claude-sonnet-4-6` — neither exists. Current: Fable 5 / Opus 4.8 (orchestrator), Sonnet 5 (executors), Haiku 4.5 (qa) | HIGH |
| Wrong pronouns | ORCHESTRATOR calls Kira "she/her" throughout; KIRA.md says him | LOW |
| Hardcoded MCP prefixes | ROUTING Layer 2 uses `mcp__supabase__*` — real names are session-scoped (`mcp__0081b859-…__*`). NOTION_SYNC already has the right rule ("call by capability, never hardcode the server ID"); ROUTING contradicts it | MED |
| Duplication | DISPATCH_GATE summarized inside ORCHESTRATOR §"DISPATCH GATE"; LOOP summarized inside ORCHESTRATOR §"LOOP MODE"; REQUEST template appears verbatim in BOTH ORCHESTRATOR Step 3 and ROUTING Layer 5; Council rules in both ORCHESTRATOR and ROUTING Layer 6 | MED (token + drift risk) |
| Dead weight in live folders | `overnight.log` 52,701 words (gitignored ✓ but read-adjacent), `.scratch/` leftovers, ORCHESTRATOR_ISSUES 2.3k words of mostly-resolved history | MED |

**The fix (one overnight block):**
1. Generate `.claude/agents/*.md` from `BOH/*.md` + `FOH/*.md` — thin files: frontmatter
   (name, description, tools, model) + "read your BOH/FOH file + PRODUCT-VISION slice."
   That makes `subagent_type: backend` real. **This is the difference between a system
   that documents agents and one that runs them.**
2. ORCHESTRATOR.md 2,586 → ~700 words: cut INTAKE MODE (→ KICKOFF.md owns new-project
   intake), cut Portability (→ README), cut the duplicated gate/loop/council/template
   sections (link instead), fix models + pronouns, keep: startup order, mode table,
   review protocol, security gate, comms rules compressed to ~10 lines.
3. Verification wiring already exists (flow graph + `tools/e2e_smoke.py` in
   DISPATCH_GATE Layer 6, added 2026-07-07) — the compacted ORCHESTRATOR points at it.

## 2 · Folder structure

Structure itself is sound (config/memory/skills/automation/deliverables split is right).
Two hygiene rules, not a reorg:

- **Live vs archive.** `briefs/` + `deliverables/` are append-only history — fine on disk,
  but startup must never read them (MAP mostly says this; make it explicit in LOOP).
  Archive resolved MESSAGE_BUS + ORCHESTRATOR_ISSUES entries to `memory/archive/`.
- **SESSION_LOG cap.** 43 KB and growing unbounded; "read last 3" isn't enforceable when
  the file is one blob. Rule: SESSION_LOG.md holds the last 3 sessions only; older
  entries roll to `memory/archive/SESSION_LOG-<year>.md` at session close.

## 3 · Notion

**Verdict: healthy connection, stale content, manual sync is the structural weakness.**

- Connection ✓ (queried live today). SQL mode: worked once, then 429
  (`collection_router_upstream_429`) — NOTION_SYNC's "SQL unreliable, use view mode"
  guidance is correct as written. View mode returned all 57 rows first try.
- **Drift confirmed:** F1 `/payments/mine` + F2 disputes show *Not started* (due Jul 12,
  gate items) but both shipped 2026-07-01. I attempted the flip; permission layer
  blocked external writes in this review session → left for Kira (~30 seconds, three
  rows: F1, F2, and "Notion — F1/F2 stale rows").
- **D4 due today (Jul 7)** while its prerequisites D2.0/D3 are In progress → date is
  ahead of the build sequence. Decision: push D4's date or accept slip.
- **Recommendation: keep it manual for beta.** It's a nudge layer, not truth — STATUS.md
  stays canonical, LOOP step 5's drift check protects against stale rows. Building
  git→Notion auto-sync now is scaffolding; revisit post-beta.

## 4 · Token usage

**Session boot today ≈ 20,300 words ≈ ~27k tokens read before any real work** —
and overnight runs pay a slice of it per spawned subagent.

| File | Now (words) | Target | How |
|---|---|---|---|
| ORCHESTRATOR.md | 2,586 | ~700 | cuts in §1 |
| SESSION_LOG.md | 5,816 | ~600 | last-3 rule + archive |
| MESSAGE_BUS.md | 1,794 | ~200 | prune RESOLVED |
| ORCHESTRATOR_ISSUES.md | 2,304 | ~300 | archive resolved |
| ROUTING.md | 973 | ~700 | drop duplicated template/council |
| Rest of chain (CLAUDE.md 958, KIRA 421, GATE 1,082, LOOP 656, VISION 606, NOTION_SYNC 1,039, MCP_INV 930, PATH-INDEX 223, STATUS 1,037, PLAN 1,197, HUMAN-TODO 1,011) | ~9,160 | ~8,500 | minor trims only — these earn their keep |
| **Boot total** | **~20,300** | **~9,000** | **≈ 55% cut** |

Second lever — **model routing** (bigger $ than any doc trim): the Step 5 table has the
right idea with dead names. Update to: orchestrator = the top model, executors =
Sonnet 5, qa/log-summarization = Haiku 4.5. Never the top model for execution.
Third lever: subagents get their ROLE slice + PATH-INDEX only — never MAP/ORCHESTRATOR.

## 5 · Ollama (local AI)

**Installed and idle:** v0.31.1, RTX 4060 laptop (8 GB VRAM) + 32 GB RAM.
Models on disk: qwen3 5.2 GB · gemma4 9.6 GB · llama2 3.8 GB · qwen3.6 23 GB.

**Honest verdict — where local models do NOT belong:** agentic coding. The bug class
fixed yesterday (payload drift, wrong endpoints) came from frontier-model work; a 5–9 GB
local model produces more of those, and every one lands in your 7:15–9:45 review window.
Local coding agents would make you slower, not faster.

**Where they DO belong (cheap, private, error-tolerant):**
1. **Overnight-log compression** — qwen3 via `localhost:11434` summarizes
   `overnight.log` into the morning brief's DONE/NEEDS-YOU/NEXT skeleton. Zero API cost,
   feeds §4 directly. This IS the parked "Qwen 3 overnight wiring" Notion row.
2. **i18n first drafts** — FR/AR catalog translations for `mobile/src/i18n.js`;
   Claude reviews, never ships raw.
3. **Waitlist/inbox triage classification** (FOH) — categorize, never send.

**Housekeeping:** delete `llama2` (obsolete) and `qwen3.6` (23 GB never fits 8 GB VRAM;
CPU offload runs 1–3 tok/s) → frees ~27 GB. Keep qwen3 + gemma4.
**Timing:** wire item 1 only; it rides the existing n8n morning brief. Items 2–3 post-beta.

---

## NEEDS-KIRA

1. **Approve the compaction + agent registration** (§1 fixes 1–2, §2 rules, §4 model
   table) — one overnight block, committed to AGENTS/ per the sync rule before use.
2. **Flip 3 Notion rows to Done** (F1, F2, the flip-task) — blocked for me this session.
3. **D4 date:** push to after D2.0/D3, or accept slip?

*[[MAP]] · companions: scale-upgrade-map-2026-07-07 · smoke gate in DISPATCH_GATE Layer 6*
