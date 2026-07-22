---
group: plan
project: swingby
hub: "[[MOC-Plan]]"
tags: [plan, learning, principles, append-only, book]
type: meta-log
status: ever-growing
started: 2026-06-26
links: [[../DOMINOES]]
---

# 📚 _LEARNING-LOG — the book that grows across all dominoes

> The **book**: this file never gets edited backwards. Every entry is appended at the bottom under a dated heading. Over time, this becomes the most valuable file in the repo — the compressed wisdom of the build.
>
> Each domino has its own `🎓 Learning` section. The best lessons get **promoted** here, because they apply across dominoes.
>
> When you re-read this in a month, you'll be your future self thanking your past self.

---

## 📐 How to use this file

1. **During a domino** — capture rough notes in that domino's `🎓 Learning` section.
2. **End of a domino** — read the rough notes. Promote the ones that are general (not specific to that one domino) to this file as a new dated entry.
3. **Never edit prior entries.** If a lesson turns out wrong, write a new entry: "Update to 2026-06-26 #3 — turns out…". The wrong lesson stays as historical context.
4. **Keep it tight.** One bullet = one idea. If it's two ideas, split into two bullets.

---

## 🧠 Promoted principles (the most cited, kept at top for fast scanning)

These are the lessons that show up in 3+ dominos' logs. Stop here when scanning.

- **Trust `git log`, not STATUS.md.** The orchestrator LOOP can lag reality by a session. The working tree is the truth.
- **Interview before plan. Plan before code.** Asking 4 calibration questions saved a half-day this week.
- **The book convention (append-only logs per file)** compounds. After 3 dominoes, the historical context is worth more than the present-tense docs.
- **Beta = real human, real device, real money flow (sandbox).** Anything short is rehearsal.

---

## 📖 Log (append-only)

---

### 2026-06-26 — kickoff: book convention established

**What:** Created [[../DOMINOES|DOMINOES.md]] index + 9 domino files (D2.0 → D5) under `dominoes/`. Each file has the same shape: goal · why · pre-reqs · steps · done-rule · append-only Log · Learning.

**Why the book convention exists:**
- Past projects have died because nobody could remember *why* a choice was made.
- A flat doc gets rewritten and the history dies.
- An append-only file is a journal — you can re-read it like chapters.
- Three months from now, when you wonder "why did we skip EAS for D3?" the answer is in [[D5-paid-testers|D5]]'s log: money posture.

**Lessons captured today:**
- Don't trust STATUS.md without `git log` + `git status`. (Verified: 4 "uncommitted" fixes were already in `origin/main`; CHECK bug was already fixed.)
- The "kill mock data" claim was true (zero mock strings in screens) BUT verification against live Render had never been done. Code-side done ≠ user-flow done.
- A 32-screen app inventory ≠ a complete app. Trust card on `EmployeeProfileScreen` showed no signals at all — caught by reading the file, not by trusting the bucket reorg memory.
- Monetization is two questions, not one: per-transaction (escrow cut) and platform-access (subscription). Conflating them wastes a conversation.

**Pattern noticed:**
- Memory files (PROJECT/PHASE) are point-in-time. They are *useful as a starting hypothesis*, not as a source of truth. Always verify before quoting.

---

<!-- Future entries go below this line. Add a new dated heading; do not edit anything above. -->

<!-- graph-wire:start -->
---
**Up:** [[MOC-Plan]] · **Home:** [[SWINGBY]]

**Related:** [[D2.0-live-walkthrough]] · [[D3-expo-go-walkthrough]] · [[D5-paid-testers]] · [[DOMINOES]] · [[STATUS]]
<!-- graph-wire:end -->
