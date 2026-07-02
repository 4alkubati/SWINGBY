# 🚀 KICKOFF — spin this kit up in a new project

> Read by the `kira-kickoff` skill (`~/.claude/skills/kira-kickoff/`) or by any Claude session told to "kick off a new project". Input: a project idea + a target directory. Output: a repo scaffolded the way Kira operates, with a full roadmap generated — not copied.

Back to [[MAP]].

---

## How Kira operates (the OS you are instantiating)

1. **Dominoes, not backlogs.** The plan is one ordered list of the smallest blockers between today and the north star (`Roadmap/DOMINOES.md`). Each domino gets its own file with: frontmatter → Goal (one sentence) → Why → Pre-reqs (wikilinks) → numbered copy-pasteable steps, each ending with a verify line → binary Done-rule → **📖 Log (append-only — never edit history)** → 🎓 Learning.
2. **Buckets.** Every task is A (agent can do alone), B (human-only: dashboards, phones, money, keys), or C (human review/push gate). Agents never stall on B/C — they park it in `HUMAN-TODO.md` with the *exact* click-by-click action and keep moving.
3. **STATUS is rewritten, not appended.** `AGENTS/claude/memory/STATUS.md` is the single source of "what is true right now", rewritten at session end. Claims of "pushed/live/verified" must be *verified against origin and the live URL* before being written — STATUS lying to the loop is the most expensive failure mode this system has had.
4. **She directs, agents build overnight, she reviews ~2 hrs.** Daily files are written so her review window is decisions, not debugging: WIN CONDITION (1–3 checkboxes) → MORNING/NIGHT pure-action blocks → OVERNIGHT dispatch line → SCORECARD (the one task that counts) → GLOSSARY at the bottom (steps never explain inline).
5. **The 7-layer dispatch gate** (`claude/config/DISPATCH_GATE.md`) fronts every task: frame 5W+H → obstacle train → read memory/write plan → prep+run → two briefs → review & execute → frame tomorrow's first task.
6. **BOH ∥ FOH.** Technical work and image/marketing work run as separate lanes with separate agents; the morning brief merges them.
7. **Verify before claiming.** Every "done" needs a live check (curl the route, run the test, load the screen). CI must be green and *meaningful* — a red or never-passing CI is treated as a bug in the system itself.

## Generation steps (do in order)

### 1. Interview (5 min, ask only what can't be inferred)
North star in one sentence · launch window · platforms (web/mobile/API) · stack preference (default: FastAPI + Supabase + React/Expo + Cloudflare, as proven here) · what exists already · who pays whom (marketplace? SaaS? content?).

### 2. Scaffold the repo
```
<project>/
├── AGENTS/            ← copy THIS folder wholesale, then reset per §3
├── Roadmap/           ← generate per §4 (do NOT copy SwingBy's content)
├── docs/              ← empty + README stub; grows API.md, schema, DEPLOY.md
├── credentials/       ← README only; gitignore `credentials/*` + `!credentials/README.md`
├── CLAUDE.md          ← master context: what/stack/monorepo/db/deploy/test-creds/reference-docs (mirror SwingBy's structure, ~150 lines max)
├── README.md          ← real front page: what it is, stack table, quickstart, CI badges
├── .gitignore  .gitattributes (`* text=auto`)  .github/workflows/ (lint+test CI with stub env vars from day 1 — CI that never passes is worse than none)
```

### 3. Reset the AGENTS kit for the new project
- Wipe `claude/memory/`: fresh STATUS ("Phase 0 — scaffolded, nothing built"), empty HUMAN-TODO / SESSION_LOG / MESSAGE_BUS / ORCHESTRATOR_ISSUES (keep headers + book convention notes).
- Wipe `claude/deliverables/` and `briefs/` (keep folders + a README line).
- Rewrite `claude/PRODUCT-VISION.md` role-sliced for the new product.
- Keep unchanged: `config/` rulebooks, `skills/`, `BOH/`/`FOH/` agent definitions, `automation/` (re-point paths).
- `KIRA.md` stays gitignored and machine-local.

### 4. Generate the Roadmap
- `Roadmap/README.md` — north star ("By <date>: <observable reality>"), the three phases (**Build → Polish+Prep → Launch**) as a table with "Done when" columns, and the first 4 dominoes.
- `Roadmap/DOMINOES.md` — ordered domino index using the book convention (copy the convention section verbatim from SwingBy's; it's product-agnostic).
- `Roadmap/dominoes/D1…Dn.md` — generate 5–9 dominoes ending at "a real stranger completes the core loop and money/value moves". D1 is always the *smallest end-to-end proof* (e.g., "email actually sends", "one row round-trips"), never infrastructure polish.
- `Roadmap/<Month>/` + `_TEMPLATE-daily.md` (copy template verbatim) + first daily file for tomorrow, written to the WIN CONDITION format.
- `Roadmap/COSTS-CREDENTIALS-APIS.md` — every service, its cost, where its key lives.

### 5. First commit + guardrails
`git init` → commit scaffold → create GitHub repo (**private by default** — public needs an explicit decision because marketing/investor docs and CLAUDE.md become world-readable) → enable Dependabot alerts, secret scanning, push protection → verify CI green on the scaffold.

### 6. Hand back
End with: the north star sentence, the domino list, tomorrow's daily file, and the 3 Bucket-B items the human must do first. Write STATUS accordingly.

## Anti-patterns (learned the hard way — don't regenerate them)
- Committed briefs claiming work is "live-verified" without hitting the live URL.
- Junk at repo root (`tree.txt`, `Untitled.base`) — scratch goes to scratchpads, not the repo.
- Two docs for one topic (DEPLOY vs DEPLOYING) — one file per topic, merge on sight.
- Real API keys in any committed file, ever (`app.json` Maps-key incident, 2026-07-01).
- Editing append-only files (MESSAGE_BUS timestamp corruption, 2026-07-01) — logs are write-forward only.
