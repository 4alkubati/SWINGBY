# SwingBy — Full Repo Audit + Forward Plan
> Written 2026-07-01 by Claude (orchestrator session). Scope: every top-level folder, git state, docs, Roadmap, AGENTS kit, and goal-tracking vs DOMINOES. Nothing was changed — this is the assessment; the fix plan is at the bottom as dispatchable agent briefs.

---

## 1. Verdict in one paragraph

The codebase itself is in good shape — mobile screens are properly bucketed, the flow graph reports **zero orphan screens and zero broken navigation edges**, the backend has 65 routes live, and D2.1–D2.4 code exists. The problems are all **around** the code: a working tree with ~27 modified + ~40 untracked files that has not been pushed in days (one combination of which would **break the Render deploy**), two corrupted memory files from stray keystrokes in Obsidian, duplicate/legacy doc files, a 5.8 MB junk file at root, an inconsistent Roadmap (June nearly empty, July 5 missing), and 2 known broken API calls. Everything is fixable in one hygiene pass + one commit series.

---

## 2. 🚨 Critical — fix before anything else

### C1. The working tree is a deploy-breaking trap
`backend/app/main.py` (modified, tracked) imports three routers whose files are **untracked**:
- `backend/app/api/invoices.py`
- `backend/app/api/subscriptions.py`
- `backend/app/api/payments_offplatform.py`

If anyone runs the "suggested commit" still sitting in HUMAN-TODO (which stages only `Roadmap/ AGENTS/... CLAUDE.md docs/`) and then pushes, Render redeploys a `main.py` that imports modules that don't exist in git → **the whole API crashes on boot**. Same risk for `mobile/src/screens/shared/InvoiceScreen.js` (untracked, but imported by both committed navigators).
**Fix:** commit series in §6 keeps code + its imports atomic. The HUMAN-TODO Bucket-C instruction is stale and must be rewritten.

### C2. Memory-file corruption from manual editing
- `AGENTS/claude/memory/MESSAGE_BUS.md` — H1 title gained a leading space (` # MESSAGE_BUS`) and a historical timestamp was typed over: `2026-06-23T1v 6:00:00Z`. This is an append-only file; history was accidentally edited.
- `AGENTS/claude/memory/ORCHESTRATOR_ISSUES.md` — stray whitespace after frontmatter + full table reflow (Obsidian auto-format). Cosmetic, but it buries real diffs in noise.
**Fix:** `git checkout -- AGENTS/claude/memory/MESSAGE_BUS.md` (restores clean history). For ORCHESTRATOR_ISSUES, either revert or accept the reflow once — but then stop editing agent memory files in Obsidian's live-preview mode (it auto-reformats tables on open).

### C3. STATUS.md vs disk mismatch on the June backfill
STATUS and commit `1f1801b` both claim "backfilled `Roadmap/June/` daily files for Jun 21–30". Reality: that commit added a **single** `Roadmap/June.md`; the working tree has since deleted it (uncommitted) and created an untracked `Roadmap/June/` containing **only `2026-06-22.md`**. The June 21–30 content lives only inside the deleted-but-recoverable `June.md`.
**Fix:** recover `June.md` content from git, split into `Roadmap/June/2026-06-XX.md` dailies (matching July's structure), then delete `June.md` for real. Do NOT push until this is done or the June history is silently lost.

---

## 3. 🗑️ Trash — delete (or archive) list

| Item | What it is | Disposition |
|---|---|---|
| `tree.txt` (root, **5.8 MB**) | Windows `tree` dump of the whole disk incl. node_modules | **Delete.** Add `tree.txt` to `.gitignore`. The flow graph + WORKSPACE-MAP already cover structure. |
| `Untitled.base` (root, 0 bytes) | Accidental empty Obsidian Bases file (Jun 26) | **Delete.** |
| `docs/ops/`, `docs/testing/` | Empty directories | **Delete** (or drop a README stub if they're planned — currently they're just noise). |
| `CNAME` (root) | Vestige of old GitHub Pages deploy (per WORKSPACE-MAP) | **Verify then delete:** confirm swingbyy.com DNS is 100 % Cloudflare Pages, then remove. |
| `.expo/` at repo root | Expo was run from root instead of `mobile/` at some point | Gitignored already; safe to delete the folder locally. |

## 4. 🔀 Duplicates & misplaced — merge/move list

| Item | Problem | Disposition |
|---|---|---|
| `docs/DEPLOY.md` + `docs/DEPLOYING.md` | Two deploy guides; DEPLOYING even links to DEPLOY as "the original" | **Merge into one `docs/DEPLOY.md`** (Render + Cloudflare + env checklist sections). CLAUDE.md already points at DEPLOY.md only. |
| `project-docs/` (4 files: DESIGN_MEMO, PARITY_AUDIT, RELEASE_NOTES, capp-context.pdf) | Legacy folder duplicating `docs/`'s job; WORKSPACE-MAP lists both with no distinction | **Move contents into `docs/` (or `docs/archive/`), delete `project-docs/`**, update WORKSPACE-MAP. |
| Legal text in 3 places (`docs/legal/`, `privacy-and-security/`, `web/launch/src/pages/`) | Documented convention, but nothing enforces sync | Keep, but add a one-line header to each dev copy: "canonical = privacy-and-security/; update all three" (docs/legal README should already say this — verify). Candidate for a later drift-check script. |
| `Roadmap/July/2026-07-05.md` | Missing — 01–04 and 06–31 exist | **Create it** (stub from `_TEMPLATE-daily.md`) so the daily chain is unbroken for Obsidian nav. |
| `Roadmap/July/` 08–31 | Untracked empty stubs | Fine to keep — but commit them so the vault is consistent across machines. |
| `.vscode/settings.json` | Untracked; harmless unittest config | **Commit it** — it encodes the test-runner convention. |
| `AGENTS/claude/automation/GEN 1.md` | Space in filename (breaks some wikilink/URL contexts) | **Rename** to `GEN-1.md`, fix inbound links. |

## 5. ✅ What's genuinely in good shape (don't touch)

- **Mobile navigation graph:** 0 broken edges, 0 orphan screens (Map screens correctly deleted — only a harmless comment reference remains in `NearbyMapScreen.web.js`). 55 screens / 4 navigators all reachable.
- **Screen bucketing:** all 9 buckets, nothing flat at `mobile/src/screens/` top level.
- **`credentials/` handling:** correctly gitignored (`credentials/*` + `!README.md`); the `??` in git status is just the un-committed README. Commit it and the noise disappears.
- **Dominoes system:** `Roadmap/DOMINOES.md` + `Roadmap/dominoes/D*.md` with the book convention is the strongest organizational asset in the repo. Keep it the single source of build order.
- **`docs/FLOW_GRAPH.md` + `tools/flow_graph.py`:** exactly the right kind of generated artifact; already wired into CLAUDE.md.
- **marketing/ and privacy-and-security/:** numbered, orderly, no action needed.
- **AGENTS kit layout** (`config/ memory/ skills/ automation/ deliverables/ BOH/ FOH/`): sound structure; the problem is only the two corrupted memory files (§2).

---

## 6. Goal check — DOMINOES vs reality (2026-07-01)

| Domino | Claimed | Verified on disk | Blocked on |
|---|---|---|---|
| D1 emails | ✅ `08715e3` | ✅ committed | — |
| D2 kill mock data | ✅ | ✅ | — |
| D2.0 live walkthrough | 🟡 waiting | **not done** | Kira's iPhone |
| D2.1 trust card | ✅ `a1e8fdf` | ✅ committed | on-device verify |
| D2.2 invoices | in progress | **code-complete in working tree, uncommitted** (`invoices.py`, `InvoiceScreen.js`, navigator wiring, reportlab in requirements) | commit + push |
| D2.3 off-platform pay | — | **code exists uncommitted** (`payments_offplatform.py` + BookingDetails/JobManagement diffs) | commit + push |
| D2.4 business subscription | today's loop target | **backend exists uncommitted** (`subscriptions.py`, Stripe webhook edits); mobile Plan card partially present (BusinessProfile +183 lines) | commit + push, then Stripe keys for live test |
| D3–D5 testers | ⬜ | ⬜ | D2.0 + seed accounts |

**Bottom line:** the Jun 27 → Jul 7 beta schedule is on track *code-wise* — D2.2/D2.3/D2.4 appear substantially built — but **nothing since `a1e8fdf` is committed**, and all four human gates (push, walkthrough, seed accounts, Stripe keys) are still open. The bottleneck is not code; it's Bucket B/C.

**Known code gaps (from MOBILE-FINISH-LINE.md, confirmed by flow graph):**
- **F1** — `GET /payments/mine` missing → EarningsScreen dead (~30 min, backend only)
- **F2** — no disputes router/table → DisputeFlow submit 404s (~half day, backend + migration)

**Backlog debt (ORCHESTRATOR_ISSUES):** H1 (Maps key in app.json → EAS secret), H2 (rotate admin password), H3 (HIBP protection), H5–H7, H10 remain open. None block beta; H1/H2 should close before any external tester gets a build.

---

## 7. Proposed commit series (for Kira — Bucket C)

Atomic, deploy-safe order. Each commit is shippable on its own.

```bash
# 0. restore corrupted memory file (before staging anything)
git checkout -- AGENTS/claude/memory/MESSAGE_BUS.md

# 1. D2.2 invoices — code + its imports together
git add backend/app/api/invoices.py backend/requirements.txt \
        mobile/src/screens/shared/InvoiceScreen.js \
        mobile/src/navigation/BusinessNavigator.js mobile/src/navigation/ClientNavigator.js \
        mobile/src/services/api.js
git commit -m "feat(D2.2): invoices — backend PDF receipts + InvoiceScreen"

# 2. D2.3 off-platform pay
git add backend/app/api/payments_offplatform.py \
        mobile/src/screens/client/BookingDetailsScreen.js \
        mobile/src/screens/business/JobManagementScreen.js
git commit -m "feat(D2.3): off-platform payment marking"

# 3. D2.4 subscriptions (backend + Plan card)
git add backend/app/api/subscriptions.py backend/app/api/payments_stripe.py \
        backend/app/api/interests.py backend/app/main.py \
        mobile/src/screens/business/BusinessProfileScreen.js \
        mobile/src/screens/business/DashboardScreen.js
git commit -m "feat(D2.4): business subscription — plan tiers, accept gate, webhook"

# 4. remaining mobile fixes + Map removal
git add mobile/
git commit -m "fix(mobile): screen polish; remove dead MapScreen (superseded by NearbyMap)"

# 5. backend leftovers (employees etc.)
git add backend/
git commit -m "feat(backend): employee profile polish"

# 6. docs + roadmap + agents (AFTER June recovery from §2-C3)
git add Roadmap/ docs/ AGENTS/ CLAUDE.md .vscode/ credentials/README.md
git commit -m "docs: July dailies, flow graph, finish-line plan, agents memory"

git push origin main
```
> Before step 6, run the June recovery: `git show HEAD:Roadmap/June.md > /tmp/June.md`, split into `Roadmap/June/2026-06-XX.md` files, keep the existing `2026-06-22.md`.

---

## 8. Agent dispatch plan

Five briefs, in dependency order. All obey the standing guardrails: **no `git push` (Bucket C = Kira)**, no schema-destructive migrations, `credentials/` never staged, STATUS + SESSION_LOG updated at end of run.

### A1 — Repo hygiene sweep *(no code, ~1 h, run first)*
**Goal:** root and docs contain zero junk, zero duplicates, zero empty dirs.
**Steps:** delete `tree.txt` + `Untitled.base` + empty `docs/ops` `docs/testing`; add `tree.txt` to `.gitignore`; merge `DEPLOYING.md` into `DEPLOY.md`; move `project-docs/*` → `docs/archive/`; rename `GEN 1.md` → `GEN-1.md` + fix links; recover June dailies from `git show HEAD:Roadmap/June.md` and split into `Roadmap/June/`; create `July/2026-07-05.md` stub; revert MESSAGE_BUS corruption; update WORKSPACE-MAP + CLAUDE.md references.
**Done-rule:** `git status` shows only intentional changes; every CLAUDE.md reference resolves; `Roadmap/June/` has Jun 21–30 files.

### A2 — F1 + F2 backend gaps *(backend, ~half day)*
**Goal:** flow graph reports **0 broken API calls**.
**Steps:** (F1) add `GET /payments/mine` in `payments.py` — sum/list payments for caller's business, wire EarningsScreen. (F2) `disputes` table + RLS migration, `disputes.py` router (POST create, GET mine, admin resolve), wire DisputeFlowScreen. Regenerate flow graph; run `smoke_e2e.py` locally.
**Done-rule:** `python tools/flow_graph.py` → "Broken API calls: none".

### A3 — D2.4 completion *(per `Roadmap/July/2026-07-01.md` + D2.4 domino)*
**Goal:** business user sees a Plan card; un-subscribed business hits a clear 402 upsell at Accept.
**Steps:** in the D2.4 domino file (book convention — append to 📖 Log). Verify webhook handles `customer.subscription.*`; beta posture = track-only/`trialing` per the locked default.
**Done-rule:** the domino's own done-rule + scorecard line in the daily file checked.

### A4 — Backlog burn-down H1/H2 prep *(before first external tester)*
**Goal:** no plaintext Maps key in `app.json`; admin password rotation documented for Kira.
**Steps:** move key to EAS secret (document the `eas secret:create` step in HUMAN-TODO since it needs Kira's Expo login); write rotation steps to HUMAN-TODO.
**Done-rule:** `grep googleMapsApiKey mobile/app.json` returns a placeholder only.

### A5 — Obsidian vault linking pass *(with Kira, after A1)*
See §9 — this is the next joint session.

### Kira (Bucket B/C — the real bottleneck, ~45 min total)
1. Run the §7 commit series + push (10 min)
2. D2.0 iPhone walkthrough → bug list into the daily file (20 min)
3. Create 3 seed accounts in Supabase Auth, Auto-Confirm ON (5 min)
4. Stripe keys → Render env + webhook endpoint (10 min)
5. DMARC TXT record on swingbyy.com (2 min)

---

## 9. Obsidian vault plan (next phase — outline)

The repo **is** the vault (`.obsidian/` at root, correctly gitignored). Current linking problems observed:

1. **Mixed link styles** — some files use `[[MAP]]`-style bare wikilinks (resolve only if filenames are unique), others use relative-path wikilinks (`[[../../AGENTS/claude/memory/STATUS|STATUS.md]]`), others plain markdown links. Bare links break the moment a second `README.md`-like name appears — and this vault has **~10 README.md files**.
2. **README name collisions** — `Roadmap/README.md`, `Roadmap/July/README.md`, `marketing/README.md`, etc. all fight for `[[README]]`. Titles like `[[README|Roadmap/README]]` in DOMINOES.md are already working around this.
3. **Orphan notes** — `Untitled.base`, `WORKSPACE-MAP.md`, `project-docs/*`, most of `docs/` have no inbound links; the graph view is fragmented into islands (AGENTS island, Roadmap island, docs island).
4. **Editing hazard** — Obsidian auto-reformat corrupted MESSAGE_BUS/ORCHESTRATOR_ISSUES (§2-C2). Agent memory files should be read-only in Obsidian or excluded via Obsidian's "Files & Links → Excluded files".

**Proposed approach (to execute together next session):**
- **Hub notes:** make `CLAUDE.md` the technical hub, `Roadmap/DOMINOES.md` the plan hub, `AGENTS/MAP.md` the agent hub, and create one `HOME.md` at root linking the three + WORKSPACE-MAP. Every folder README links up to its hub and down to its children.
- **Link convention:** relative-path wikilinks with display text everywhere (`[[../DOMINOES|DOMINOES]]`), never bare `[[README]]`. Set Obsidian "New link format → Relative path" in `.obsidian/app.json`.
- **Daily-note chain:** each `Roadmap/<Month>/<date>.md` gets prev/next links (template already supports it); month READMEs list their days.
- **Exclusions:** exclude `AGENTS/claude/memory/` from Obsidian editing, and `node_modules`/`dist`/`web/*/dist` from indexing (Excluded files) so the graph and quick-switcher stay clean.
- **Sweep:** one scripted pass (Python, not PowerShell — encoding trap) to find dead wikilinks + orphans and fix them; then regenerate the graph screenshot as a deliverable.

---
*Deliverable of the 2026-07-01 audit session · next: A1 hygiene sweep on approval · [[../memory/STATUS|STATUS]] not yet updated (no changes made this session)*
