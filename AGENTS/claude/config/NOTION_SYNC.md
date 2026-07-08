# NOTION_SYNC — the nudge layer

Back to [[MAP]] · [[_CONFIG]]

> Added to the stack 2026-07-06. Notion joins Google Calendar as a connected-tool nudge source — not a new source of truth. [[../memory/STATUS|STATUS]] stays the single source of truth for what shipped.

## 5W+H

- **Who:** orchestrator, via the Notion MCP connector (Kira's personal workspace, already authenticated in-session). Tool names are session-scoped (`mcp__<id>__notion-*`) — call by capability (`notion-search`, `notion-fetch`, `notion-query-data-sources`), never hardcode the server ID.
- **What:** the **SwingBy** database — one row per Domino / Backend Gap / Launch Checklist / Golden Path Test item, originally generated from `Roadmap/DOMINOES.md`, `Roadmap/dominoes/*.md`, `docs/LAUNCH_CHECKLIST.md`, `Roadmap/MOBILE-FINISH-LINE.md` (see each row's `Source File`).
- **When:** read at LOOP startup (step 5, added below) and before every STATUS.md rewrite. Also on-demand whenever Kira asks "what's due" or "what's slipping."
- **Where:** Notion workspace — database `3605bdb1-e73d-44e5-9f66-31b4fe1fcfe3`, data source `collection://7416839b-6a91-48e2-9550-5666834f36ec`.
- **Why:** the Roadmap `.md` files are the plan; STATUS.md/git commits are the truth of what shipped. Neither nudges — nobody re-reads five files to notice a date passed. This DB's Due Date + Gate Item + Is Blocked columns answer "what's missed" in one query.
- **How:** query pattern and nudge rule below.

## Schema (data source `collection://7416839b-6a91-48e2-9550-5666834f36ec`)

| Column | Type | Notes |
|---|---|---|
| Name | title | task / checklist item |
| Status | status | Not started / In progress / Done |
| Priority | select | Now / Next / Later |
| Type | select | Domino / Backend Gap / Launch Checklist / Golden Path Test / Human To Do (added 2026-07-06 — see Type meanings below) |
| Section | text | Backend / Security / Product / Database / Ops+analytics / Legal+comms |
| Is Blocked | checkbox | true = flag regardless of due date |
| Gate Item (non-negotiable) | checkbox | true = cannot ship the milestone without this |
| Milestone | select | Beta Live - Aug 31 / Public Launch - Oct 20 |
| Due Date | date | |
| Source File | text | which `.md` file generated this row — **manual**, this DB does not auto-write back |

## Type meanings (Kira asked 2026-07-06 — "Golden Path Test" and "Launch Checklist" weren't obvious)

| Type | What it actually is | Source |
|---|---|---|
| **Domino** | A build-order milestone from the roadmap (D1, D2, D2.1...D5) — the sequenced path to launch. One domino unblocks the next. | `Roadmap/DOMINOES.md`, `Roadmap/dominoes/*.md` |
| **Backend Gap** | A missing API endpoint or backend piece the mobile app already expects but doesn't exist yet (named F1, F2...). Found by the flow-graph scanner, not planned in advance. | `Roadmap/MOBILE-FINISH-LINE.md` |
| **Launch Checklist** | A pass/fail line item that must be true before **public launch (Oct 20)** specifically — security hardening, store builds, legal review. Not part of the beta build order; these gate the later, bigger launch. | `docs/LAUNCH_CHECKLIST.md` |
| **Golden Path Test** | A manual end-to-end walkthrough of one full user journey (auth, client booking, business booking, edge cases) done on a real device before **beta (Aug 31)**. Proves the happy path actually works, not just that code compiles. | `Roadmap/MOBILE-FINISH-LINE.md` |
| **Human To Do** | Added 2026-07-06. Anything only Kira can do — mirrors `memory/HUMAN-TODO.md` 1:1 so it's visible on the board next to the dev work, not hidden in a separate file. | `memory/HUMAN-TODO.md` |

**Rule of thumb:** Domino/Backend Gap = code Claude writes. Launch Checklist/Golden Path Test = verification steps before a milestone. Human To Do = Kira's queue.

## Query pattern

Preferred — SQL mode via `notion-query-data-sources`:
```sql
SELECT Name, Status, Priority, "date:Due Date:start", "Is Blocked",
       "Gate Item (non-negotiable)", Milestone, "Source File"
FROM "collection://7416839b-6a91-48e2-9550-5666834f36ec"
WHERE Status != 'Done'
```
SQL mode threw `429 collection_router_upstream_429` on every attempt during setup (2026-07-06, ~6 retries over several minutes). Treat SQL mode as unreliable until proven otherwise. **Fallback that worked:** view mode against the "Master Table" view, then filter client-side:
```
mode: view
view_url: https://www.notion.so/workspace/db-id?v=e2c7b73a7f724739a7d925c11773130e
```

## Nudge rule — what counts as "missed"

1. `Due Date < today` AND `Status != Done` → **OVERDUE**.
2. `Is Blocked = true` → **BLOCKED**, regardless of date.
3. `Gate Item = true` AND `Status != Done` AND its Milestone's date is close → **GATE AT RISK**.
4. **Drift check (unique to this DB, do this before panicking Kira):** cross-reference against STATUS.md "What Got Fixed" / HUMAN-TODO "✅ Done". If Notion says `Not started` but git/STATUS says shipped, the row is **STALE**, not a real nudge — flag it as a sync gap instead.

## Known gap (fix later, not blocking)

This DB is **read + nudge only** right now. Nothing pushes git commits into it, and nothing here pushes back into Roadmap/STATUS. Whoever closes a task in git must also flip the Notion row by hand — same failure mode caught on setup day: **F1 `/payments/mine` and F2 disputes both still show "Not started" in Notion, but STATUS.md confirms both shipped 2026-07-01.** Until this is wired (n8n workflow or a git-hook that PATCHes the Notion row on merge), don't trust "Not started" in Notion without checking STATUS.md first.

**Human To Do mirror (2026-07-06):** all 12 open `HUMAN-TODO.md` items (2 blocking + 9 optional/deferred + this DB's own 2 nudges) were pushed into Notion as `Type = Human To Do` rows, one-time, by hand. This is a **manual snapshot, not a live sync** — new items added to `HUMAN-TODO.md` won't appear in Notion until someone (Claude or Kira) copies them over. Same discipline as the F1/F2 drift above: whoever edits one must remember the other exists.

## Also found on setup day (2026-07-06) — real nudge, not drift

**D4 — Friend/known-trade end-to-end run** is due **2026-07-07 (tomorrow)**, Status = Not started, Priority = Now — but D2.0 (live walkthrough) and D3 (Expo Go walkthrough) aren't done yet, and D4 depends on both per `Roadmap/DOMINOES.md` sequencing. The Notion due date is ahead of the actual build sequence. Either push the date or accept D4 slips — surfaced to Kira, not silently fixed.

---
*[[MAP]] · [[_CONFIG]] · complements [[MCP_INVENTORY]] (tool list) and [[LOOP]] (when this runs) · source of truth for build state stays [[../memory/STATUS|STATUS]]*
