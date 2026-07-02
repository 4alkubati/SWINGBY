# Agent brief — Mobile + Web folder reorganization (Phases 3 + 5)

> **Version 2 — bulletproofed for overnight execution.** Run via the AGENTS orchestrator.
> Follow `AGENTS/claude/config/DISPATCH_GATE.md` (all 7 layers).
> Apply skills: `writing-plans`, `systematic-debugging`, `verification-before-completion`, `two-stage-review`.
>
> **Goal:** regroup `mobile/src/screens/` and `web/launch/src/pages/` into
> role/audience subfolders. **Pure file-moves + import-path updates + build-gate verification.**
> No new features. No deletions. No content edits beyond import-path strings.

---

## SECTION 0 — Pre-flight (do this BEFORE writing or moving anything)

Run these in order. If any step's output contradicts an assumption in this brief, **STOP** and write `NEEDS-KIRA: <discrepancy>` to `AGENTS/claude/memory/STATUS.md`. Do not improvise.

### 0.1 — Read the orchestrator's required context (Layer 3)
```bash
cat AGENTS/claude/memory/STATUS.md
cat AGENTS/claude/memory/PLAN.md
tail -200 AGENTS/claude/memory/SESSION_LOG.md
grep -E '^(STATUS: OPEN|TYPE: BLOCKED|TYPE: ESCALATE)' AGENTS/claude/memory/MESSAGE_BUS.md
cat CLAUDE.md | head -120
cat WORKSPACE-MAP.md
```

**Stop conditions:**
- Any `STATUS: OPEN` BLOCKED/ESCALATE item with PRIORITY CRITICAL/HIGH → handle that first per ORCHESTRATOR.md §"Step 4 — Process MESSAGE_BUS".
- `STATUS.md` shows another agent currently editing files under `mobile/src/screens/`, `mobile/src/navigation/`, or `web/launch/src/` → wait or write `NEEDS-KIRA: another agent owns the same files right now`.

### 0.2 — Confirm working tree is clean
```bash
git status --short
git rev-parse --abbrev-ref HEAD
```

**Stop conditions:**
- Working tree has uncommitted edits to ANY file under `mobile/src/screens/`, `mobile/src/navigation/`, `mobile/App.js`, `web/launch/src/pages/`, `web/launch/src/App.jsx` → write `NEEDS-KIRA: uncommitted edits to reorg surface; commit or stash before reorg`.
- Branch is not `main` → confirm in `STATUS.md` why; if unclear, write `NEEDS-KIRA: unexpected branch <name>`.

### 0.3 — Discover the real build/lint commands

Mobile (`mobile/package.json`):
```bash
cat mobile/package.json | python -c "import sys, json; p=json.load(sys.stdin); print(json.dumps(p['scripts'], indent=2))"
```

Expected today: `start`, `android`, `ios` — **none of these are CI-safe** (all interactive).
**Decision:** use these two non-interactive commands as the mobile verification gate:

```bash
# 1. Bundler smoke test (catches broken imports; will run, output to throwaway dir)
cd mobile && npx expo export --platform web --output-dir .expo/.tmp-reorg-build --clear

# 2. Import-residue grep (must return 0 lines after each batch)
grep -rnE "from\s+['\"].*screens/<OLD_SCREEN_BASENAME>['\"]" mobile/src mobile/App.js mobile/index.js 2>/dev/null || echo OK
```

If `expo export` fails for an environmental reason (network, missing dep) BEFORE any move, write `NEEDS-KIRA: expo export baseline failed pre-move — environment issue, not a reorg bug` with the full error, and stop.

Web (`web/launch/package.json`):
```bash
cat web/launch/package.json | python -c "import sys, json; p=json.load(sys.stdin); print(json.dumps(p['scripts'], indent=2))"
```

Confirmed scripts: `build`, `lint`, `preview`, `dev`. Use:
```bash
cd web/launch && npm run build && npm run lint && npm audit --omit=dev
```

### 0.4 — Confirm no path-alias resolves `screens/` or `pages/`
```bash
grep -nE '(alias|paths|resolve)' mobile/babel.config.js mobile/metro.config.js mobile/tsconfig.json 2>/dev/null
grep -nE '(alias|paths|resolve)' web/launch/vite.config.js web/launch/tsconfig.json web/launch/jsconfig.json 2>/dev/null
```

If any alias maps `@/screens` or `@/pages` or similar to the folders being reorganized, **STOP** and write `NEEDS-KIRA: path alias <X> resolves to <Y>, would break silently — confirm strategy with Kira`. Aliased imports won't show up in a simple grep for relative paths.

### 0.5 — Snapshot the inventory
```bash
ls mobile/src/screens/ | sort > /tmp/reorg-mobile-screens-before.txt
ls mobile/src/components/ | sort > /tmp/reorg-mobile-components-before.txt
ls web/launch/src/pages/ | sort > /tmp/reorg-web-pages-before.txt
wc -l /tmp/reorg-*-before.txt
```

These three files are your truth source for "did I move every file?" at the end.

### 0.6 — Build the importer map (mandatory — do not skip)

For each screen in `mobile/src/screens/`:
```bash
for f in $(ls mobile/src/screens/*.js | xargs -n1 basename | sed 's/\.js$//'); do
  echo "=== $f ==="
  grep -rnE "from\s+['\"][^'\"]*screens/$f['\"]" mobile/src mobile/App.js mobile/index.js 2>/dev/null || echo "(no importers)"
done > /tmp/reorg-mobile-importers.txt
```

For each page in `web/launch/src/pages/`:
```bash
# IMPORTANT: web/launch uses React.lazy(() => import('./pages/Name')) for ALL routes.
# We must grep for BOTH the lazy form AND the static form.
for f in $(ls web/launch/src/pages/*.jsx 2>/dev/null | xargs -n1 basename | sed 's/\.jsx$//'); do
  echo "=== $f ==="
  grep -rnE "(from\s+['\"][^'\"]*pages/$f['\"]|import\(['\"][^'\"]*pages/$f['\"]\)|from\s+['\"]\./$f['\"]|import\(['\"]\./$f['\"]\))" web/launch/src 2>/dev/null \
    || echo "(no importers)"
done > /tmp/reorg-web-importers.txt
```

**Confirmed audit findings (2026-06-22):**
- All 33 top-level pages are imported in `App.jsx` via `const X = lazy(() => import('./pages/X'))`. No static `import X from './pages/X'` form for top-level pages.
- Two intra-pages imports exist:
  - `CategoryPage.jsx` imports `{ CATEGORIES }` from `./CategoriesIndex` (same bucket `marketing/` → relative path stays `./CategoriesIndex`, no edit needed).
  - `LocationCategoryPage.jsx` imports `NotFound` from `./NotFound`. After moves: `LocationCategoryPage` → `marketing/`, `NotFound` → `system/`. Update import to `from '../system/NotFound'`.
- No path aliases configured (verified `vite.config.js`, no `tsconfig.json`/`jsconfig.json`).
- `pages/app/` subdir has zero cross-imports with top-level pages → leave untouched.

Read both files. **If any screen / page has ZERO importers**, write it down — that's either dead code (don't move it, flag it) or imported via an alias / dynamic import (handle per Section 0.4).

---

## SECTION 1 — DISPATCH_GATE Layer 1 (5W+H per phase)

### Phase 3 — Mobile screens

| | |
|---|---|
| WHO | mobile-agent / overnight runner. Beneficiary: any human or agent who has to find a screen in `mobile/src/screens/` |
| WHAT | Regroup 40+ flat `.js` screens into 9 role-based subfolders (`auth/`, `onboarding/`, `client/`, `business/`, `messages/`, `profile/`, `flows/`, `shared/`, `admin/`) with every importer's path updated in lockstep |
| WHEN | Overnight 2026-06-22 → 06-23, after the tech-beta brief (T1/T2/T3) is done or paused |
| WHERE | `mobile/src/screens/**`, `mobile/src/navigation/**`, `mobile/App.js`, `mobile/index.js` |
| WHY | 40 flat files = no findability. Wrong file edits cost agents (and Kira) time. Role grouping matches the existing navigator structure |
| HOW | `git mv` per file, then `grep + sed` to update each importer, then `expo export` to gate. Batch by smallest blast radius first. Commit per bucket so a failed bucket rolls back cleanly |

### Phase 5 — Web launch pages

| | |
|---|---|
| WHO | frontend-agent / overnight runner |
| WHAT | Regroup ~35 flat `.jsx` pages into 5 audience subfolders (`marketing/`, `auth/`, `legal/`, `support/`, `system/`) with co-located `.module.css`, App.jsx + every cross-import updated |
| WHEN | Same overnight, after Phase 3 |
| WHERE | `web/launch/src/pages/**`, `web/launch/src/App.jsx` |
| WHY | Same — flat layout hides things, audience split matches IA decided in BRIEF-post-launch-site.md |
| HOW | `git mv` per file (move `.jsx` + `.module.css` together), update App.jsx routes, gate with `npm run build && npm run lint` |

---

## SECTION 2 — DISPATCH_GATE Layer 2 (obstacle train)

### Phase 3 train
```
[START — pre-flight clean]
  → 2.1 Create the 9 target dirs
  → 2.2 Round-trip test: move LoginScreen.js alone, fix importers, build green, commit
  → 2.3 Move auth/ bucket (3 more files), fix, build, commit
  → 2.4 Move onboarding/ bucket (2 files), fix, build, commit
  → 2.5 Move admin/ bucket (1 file), fix, build, commit
  → 2.6 Move flows/ bucket (2 files), fix, build, commit
  → 2.7 Move messages/ bucket (3 files), fix, build, commit
  → 2.8 Move profile/ bucket (~8 files), fix, build, commit
  → 2.9 Move shared/ bucket (MapScreen + .web variant TOGETHER), fix, build, commit
  → 2.10 Move business/ bucket (~7 files), fix, build, commit
  → 2.11 Move client/ bucket (~11 files), fix, build, commit
  → 2.12 Final sweep: ls subfolders, zero-residue grep, full build, write deliverable
[DONE]
```

### Phase 5 train
```
[START — pre-flight clean]
  → 5.1 Create the 5 target dirs (marketing, auth, legal, support, system)
  → 5.2 Round-trip: move NotFound.jsx → system/ (no CSS), fix App.jsx lazy import + LocationCategoryPage cross-bucket import, build green, commit
  → 5.3 Move Maintenance.jsx → system/ (no CSS), fix App.jsx, build, commit
  → 5.4 Move support/ bucket (HelpCenter, HelpArticle, StatusPage — no co-located CSS; HelpCenter+HelpArticle use page.module.css), fix App.jsx, build, commit
       → After 5.4: run 4C (page.module.css path fix) for just-moved support pages
  → 5.5 Move legal/ bucket (PrivacyPage, TermsPage, CookiesPage, AccessibilityPage — all use page.module.css), fix App.jsx, build, commit
       → After 5.5: run 4C for legal pages
  → 5.6 Move auth/ bucket (6 files + Auth.module.css). Auth.module.css moves WITH the bucket (only Login + Signup import it). Fix App.jsx, build, commit
  → 5.7 Move marketing/ bucket (18 files including Safety; Home.module.css and HowItWorks.module.css move with their pages; rest use page.module.css from root)
       → After 5.7: run 4C for marketing pages (the 14 that use page.module.css)
       → After 5.7: run 4D (LocationCategoryPage → NotFound cross-bucket fix)
       → Build, commit
  → 5.8 Final sweep: build + lint + audit; verify pages/ root has only page.module.css + subdirs + app/; write deliverable
[DONE]
```

Hard-as-doable rule: if any single station feels like a cliff, split it. Never skip ahead.

---

## SECTION 3 — Hard rules (read every time before each batch)

| # | Rule | Why |
|---|---|---|
| 1 | **`git mv` only**, never `mv` + `git add` | Preserve rename history |
| 2 | **Move file + its co-located `.module.css` together** in the same commit (web only) | A page and its styles are a unit |
| 3 | **NO content edits inside the moved file.** The ONLY allowed edits are import-path strings in OTHER files | Reorg is path-only |
| 4 | **One bucket per commit.** Commit message: `chore(reorg): move <bucket> screens into mobile/src/screens/<bucket>/` | Rollback granularity |
| 5 | **After each batch:** run the verification command for that surface. Red = fix or rollback. Never carry red forward | DISPATCH_GATE Layer 6 |
| 6 | **No deletions.** If a screen/page has zero importers, flag it in the deliverable as suspected dead code — do not delete | Out of scope for reorg |
| 7 | **No touching anything outside the reorg surface.** Specifically: do NOT edit `backend/`, `workers/`, `web/admin/`, `web/pre-launch/`, `marketing/`, `docs/`, `AGENTS/` (except writing to memory and deliverables) | Blast radius containment |
| 8 | **No package.json / lockfile edits.** No new deps | Out of scope |
| 9 | **No reformatting / linter auto-fixes** that touch lines you didn't intend to touch. Run lint, fix only the errors your move caused | A diff full of formatting hides real changes |
| 10 | **`git diff` review before every commit.** Every changed line should be either (a) a moved file (rename only) or (b) an import-path string change. If you see anything else, abort and investigate | Spot drift early |

---

## SECTION 4 — Per-file move recipe

Two recipes — one for mobile (`from '...screens/Name'` only), one for web (mostly `lazy(() => import('./pages/Name'))` plus a few static `from`).

### 4A — Mobile recipe (per screen file)

```bash
OLD_DIR="mobile/src/screens"
NEW_DIR="mobile/src/screens/auth"   # change per bucket
FILE="LoginScreen.js"
BASENAME="LoginScreen"

# 1. Move
git mv "$OLD_DIR/$FILE" "$NEW_DIR/$FILE"

# 2. Find every importer
IMPORTERS=$(grep -rlE "from\s+['\"][^'\"]*screens/$BASENAME['\"]" mobile/src mobile/App.js mobile/index.js 2>/dev/null)

# 3. Update each importer
for imp in $IMPORTERS; do
  sed -i.bak -E "s|(from\s+['\"][^'\"]*screens)/$BASENAME(['\"])|\1/auth/$BASENAME\2|g" "$imp"
  rm "$imp.bak"
done

# 4. Verify zero residue
RESIDUE=$(grep -rnE "from\s+['\"][^'\"]*screens/$BASENAME['\"]" mobile/src mobile/App.js mobile/index.js 2>/dev/null \
  | grep -v "screens/auth/$BASENAME" || true)
if [ -n "$RESIDUE" ]; then echo "RESIDUE: $RESIDUE"; exit 1; fi
```

### 4B — Web recipe (per page file)

```bash
OLD_DIR="web/launch/src/pages"
NEW_DIR="web/launch/src/pages/system"   # change per bucket
FILE="NotFound.jsx"
BASENAME="NotFound"

# 1. Move JSX
git mv "$OLD_DIR/$FILE" "$NEW_DIR/$FILE"

# 1b. Move co-located CSS module if it exists (Home.module.css, HowItWorks.module.css, Auth.module.css)
if [ -f "$OLD_DIR/$BASENAME.module.css" ]; then
  git mv "$OLD_DIR/$BASENAME.module.css" "$NEW_DIR/$BASENAME.module.css"
fi

# 2. Find every importer — TWO patterns because App.jsx uses React.lazy
IMPORTERS_LAZY=$(grep -rlE "import\(['\"]\\./pages/$BASENAME['\"]\)" web/launch/src 2>/dev/null)
IMPORTERS_STATIC=$(grep -rlE "from\s+['\"]\\./pages/$BASENAME['\"]" web/launch/src 2>/dev/null)
IMPORTERS_SIBLING=$(grep -rlE "from\s+['\"]\\./$BASENAME['\"]" web/launch/src/pages 2>/dev/null)
IMPORTERS=$(printf "%s\n%s\n%s\n" "$IMPORTERS_LAZY" "$IMPORTERS_STATIC" "$IMPORTERS_SIBLING" | sort -u | grep -v '^$')

# 3. Update each importer
for imp in $IMPORTERS; do
  # Form 1: lazy(() => import('./pages/Name'))   in App.jsx
  sed -i.bak -E "s|import\(['\"](\\./pages)/$BASENAME(['\"])\)|import('\1/system/$BASENAME\2)|g" "$imp"
  # Form 2: from './pages/Name'                  in App.jsx (rare/none today, future-proof)
  sed -i.bak -E "s|(from\s+['\"]\\./pages)/$BASENAME(['\"])|\1/system/$BASENAME\2|g" "$imp"
  # Form 3: from './Name'                        sibling import inside pages/ (LocationCategoryPage → NotFound case)
  # Only applies when importer is in a SIBLING bucket — handle manually for cross-bucket cases below.
  rm "$imp.bak"
done

# 4. Verify zero residue (account for new path)
RESIDUE=$(grep -rnE "(from\s+['\"]\\./pages/$BASENAME['\"]|import\(['\"]\\./pages/$BASENAME['\"]\))" web/launch/src 2>/dev/null \
  | grep -v "system/$BASENAME" || true)
if [ -n "$RESIDUE" ]; then echo "RESIDUE: $RESIDUE"; exit 1; fi
```

### 4C — page.module.css path fix (web only, run ONCE after all moves)

`page.module.css` stays at `web/launch/src/pages/`. The 22 importers all use `import styles from './page.module.css'` today. After their move into subfolders, those imports must become `'../page.module.css'`:

```bash
for f in $(grep -rlE "from\s+['\"]\\./page\\.module\\.css['\"]" web/launch/src/pages); do
  # Only edit files that are now in a subfolder (not the root pages/ itself)
  case "$f" in
    web/launch/src/pages/page.module.css) continue ;;
    web/launch/src/pages/*/*) ;;
    *) continue ;;
  esac
  sed -i.bak -E "s|from\s+['\"]\\./page\\.module\\.css['\"]|from '../page.module.css'|g" "$f"
  rm "$f.bak"
done
```

### 4D — Cross-bucket fix-up: LocationCategoryPage → NotFound (manual edit)

After `LocationCategoryPage.jsx` is in `marketing/` and `NotFound.jsx` is in `system/`:

```bash
sed -i.bak -E "s|import NotFound from '\\./NotFound'|import NotFound from '../system/NotFound'|g" \
  web/launch/src/pages/marketing/LocationCategoryPage.jsx
rm web/launch/src/pages/marketing/LocationCategoryPage.jsx.bak

# Verify
grep -n "NotFound" web/launch/src/pages/marketing/LocationCategoryPage.jsx
# Expected: import NotFound from '../system/NotFound'
```

### 4E — After every bucket: gate + commit

```bash
# Mobile gate
cd mobile && npx expo export --platform web --output-dir .expo/.tmp-reorg-build --clear && cd ..

# OR Web gate
cd web/launch && npm run build && npm run lint && cd ../..

# Diff sanity (eyeball: every non-rename diff is an import-path line)
git diff --stat
git diff | grep -E "^[+-]" | grep -vE "^(\+\+\+|---|[+-]\s*(import|from|const\s+\w+\s*=\s*lazy))" | head -20
# ↑ this should print nothing — any line shown is a non-import edit and needs investigation

# Commit
git add -A
git commit -m "chore(reorg): move <bucket> into <new path>"
```

### 4F — Rollback if a batch can't be fixed

```bash
# If 2 fix attempts after a red gate didn't work:
git restore --staged .
git restore .
git clean -fd mobile/src/screens/<bucket>/ web/launch/src/pages/<bucket>/   # remove empty subdirs created by the move
# Then write NEEDS-KIRA K4-BATCH-BUILD-RED to STATUS.md and STOP.
```

---

## SECTION 5 — Target layouts (the authoritative mapping)

> The runner builds the actual mapping at runtime from `/tmp/reorg-mobile-screens-before.txt` (Section 0.5). The list below is the **planned bucketing**. Any screen on disk not in this list goes to `shared/` by default — and gets flagged in the deliverable.

### 5A — Mobile (`mobile/src/screens/`)

| Bucket | Screens (without `.js` extension) |
|---|---|
| `auth/` | `LoginScreen`, `SignupScreen`, `ForgotPasswordScreen`, `AuthCallbackScreen` (only if exists) |
| `onboarding/` | `OnboardingScreen`, `BusinessSetupScreen` |
| `client/` | `HomeScreen`, `SearchScreen`, `NearbyMapScreen`, `NearbyMapScreen.web`, `MyJobsScreen`, `PostJobScreen`, `QuoteComparisonScreen`, `BookingDetailsScreen`, `ActiveBookingScreen`, `FavoritesScreen`, `ReviewScreen` |
| `business/` | `DashboardScreen`, `JobManagementScreen`, `BusinessAnalyticsScreen`, `EarningsScreen`, `EmployeeManagementScreen`, `EmployeeProfileScreen`, `BusinessProfileScreen` |
| `messages/` | `MessagesScreen`, `MessageThreadScreen`, `ChatScreen` |
| `profile/` | `ProfileScreen`, `ProfileEditScreen`, `PaymentMethodScreen`, `NotificationsScreen`, `NotificationsCenterScreen`, `ReferralScreen`, `HelpFAQScreen`, `PrivacyPolicyScreen` |
| `flows/` | `CancellationFlowScreen`, `DisputeFlowScreen` |
| `shared/` | `MapScreen`, `MapScreen.web` (always together) |
| `admin/` | `AdminScreen` |

**Platform-specific files** (`*.web.js`, `*.ios.js`, `*.android.js`) MUST move into the same bucket as the base file. React Native resolves them by extension; splitting them across folders breaks the resolution.

### 5B — Web launch (`web/launch/src/pages/`)

| Bucket | Pages (without `.jsx`). Each page's co-located `.module.css` moves with it |
|---|---|
| `marketing/` | `Home`, `About`, `ForClients`, `ForBusinesses`, `Pricing`, `Safety`, `HowItWorks`, `HowItWorksClients`, `HowItWorksBusinesses`, `Careers`, `Press`, `Contact`, `BlogIndex`, `BlogPost`, `CategoriesIndex`, `CategoryPage`, `CalgaryPage`, `LocationCategoryPage` |
| `auth/` | `Login`, `Signup`, `ForgotPassword`, `ResetPassword`, `VerifyEmail`, `AuthCallback` |
| `legal/` | `PrivacyPage`, `TermsPage`, `CookiesPage`, `AccessibilityPage` |
| `support/` | `HelpCenter`, `HelpArticle`, `StatusPage` |
| `system/` | `NotFound`, `Maintenance` |

**Bucketing decisions (audit-confirmed 2026-06-22):**
- `Safety.jsx` → `marketing/` (it's marketing copy about trust, not legal policy text)
- `HelpCenter.jsx` + `HelpArticle.jsx` → `support/` (user-facing help UI, not marketing)
- `StatusPage.jsx` → `support/` (system-status page is operational support)

**Shared CSS modules — confirmed via audit:**

| CSS module | Importers | Action |
|---|---|---|
| `page.module.css` | **22 pages across marketing/, legal/, support/** | **Keep at `pages/` root.** Update each importer's relative path from `./page.module.css` to `../page.module.css` after move |
| `Auth.module.css` | Login + Signup only (both → `auth/` bucket) | **Move to `pages/auth/Auth.module.css`**, no import-path change (still sibling) |
| `Home.module.css` | Home only | Move with Home into `marketing/` |
| `HowItWorks.module.css` | HowItWorksClients + HowItWorksBusinesses only | Move to `marketing/` (both importers live in marketing/) |

**`pages/app/` subdir confirmed isolated:**
- Audit verified zero imports cross between `pages/app/` and top-level `pages/`.
- `pages/app/` stays untouched. Its internal CSS modules (`Dashboard.module.css`, `BizDashboard.module.css`) stay inside `pages/app/`.

**Cross-bucket page import that requires hand-editing:**
- `LocationCategoryPage.jsx` (→ `marketing/`) imports `NotFound` (→ `system/`).
- Current line: `import NotFound from './NotFound'`
- After move: `import NotFound from '../system/NotFound'`
- This is the ONE edit that the auto-sed won't catch correctly — handle in the `marketing/` bucket step explicitly.

---

## SECTION 6 — NEEDS-KIRA exit conditions (named, not improvised)

Write `NEEDS-KIRA: <slug> — <one-line ask>` to `AGENTS/claude/memory/STATUS.md` and stop the run when any of these triggers fire:

| Trigger ID | Condition | The ask Kira sees |
|---|---|---|
| `K1-PRECHECK-DIRTY` | Working tree has uncommitted edits in reorg surface at Section 0.2 | "Commit or stash your uncommitted edits to `<files>` before reorg can start" |
| `K2-ALIAS-FOUND` | Section 0.4 finds a path alias resolving `screens/` or `pages/` | "Path alias `<alias>` would break silently — confirm move strategy" |
| `K3-BASELINE-BUILD-RED` | Section 0.3 build fails before any move | "Environment can't build `<surface>` even at baseline; investigate before reorg" |
| `K4-BATCH-BUILD-RED` | Build fails after a batch, 2 fix attempts didn't resolve it | "Batch `<bucket>` breaks build; rolled back; manual fix needed: `<error summary>`" |
| `K5-UNKNOWN-FILE` | A `.js`/`.jsx` exists in `screens/` or `pages/` not in Section 5 layout | "New file `<name>` exists that wasn't in plan; which bucket?" |
| `K6-ZERO-IMPORTERS` | A screen/page has zero importers AND no alias config explains it | "`<file>` appears dead (no importers found). Move to bucket anyway, or delete?" |
| `K7-CROSS-CUT-IMPORT` | A page in `pages/<bucket>` imports a page in another bucket | "Inter-bucket page dependency: `<A>` imports `<B>`. Confirm coupling is intentional before move" |
| `K8-LOCKFILE-DRIFT` | `git status` shows `package-lock.json` modified mid-reorg | "Lockfile changed during reorg — unexpected; investigate" |
| `K9-CONTEXT-WATERMARK` | Context use >128k tokens | "Context near limit; checkpointed `<state>` to SESSION_LOG; resume after compact" |

**Critical:** do NOT mark the brief DONE with any `NEEDS-KIRA` open. The brief stops; Kira resumes.

---

## SECTION 7 — Verification gates (per surface)

### Mobile gate (run after EVERY bucket commit)
```bash
cd mobile

# 1. Bundle the web export — non-interactive, catches broken imports
npx expo export --platform web --output-dir .expo/.tmp-reorg-build --clear
[ $? -ne 0 ] && echo "FAIL: bundle red after bucket" && exit 1

# 2. Zero-residue grep — every screen we just moved must be referenced by its NEW path
# (Run for each screen in the just-committed bucket)
for BASENAME in <list-of-just-moved-basenames>; do
  RESIDUE=$(grep -rnE "from\s+['\"][^'\"]*screens/$BASENAME['\"]" src App.js index.js 2>/dev/null \
    | grep -v "screens/<bucket>/$BASENAME" || true)
  if [ -n "$RESIDUE" ]; then echo "RESIDUE: $BASENAME"; echo "$RESIDUE"; exit 1; fi
done

cd ..
```

### Web gate (run after EVERY bucket commit)
```bash
cd web/launch
npm run build  || { echo "FAIL: build red"; exit 1; }
npm run lint   || { echo "FAIL: lint red"; exit 1; }
npm audit --omit=dev | grep -E "(high|critical)" && echo "FAIL: audit regressed" && exit 1
cd ../..
```

### End-of-phase gate (after the last bucket)
```bash
# Diff inventory: every file in /tmp/reorg-*-before.txt should now live in a subfolder
diff <(ls mobile/src/screens/*.js 2>/dev/null | xargs -n1 basename | sort) /dev/null
# Above should output nothing (no flat .js left)

ls -R mobile/src/screens/
ls -R web/launch/src/pages/
```

---

## SECTION 8 — DONE message (DISPATCH_GATE Layer 6 + verification-before-completion)

When complete, append this to `AGENTS/claude/memory/MESSAGE_BUS.md`:

```
---
ID: <timestamp>
FROM: <agent-name>
TO: orchestrator
TYPE: DONE
REF: BRIEF-reorg-mobile-web
PRIORITY: NORMAL
TIMESTAMP: <ISO-8601>
SUBJECT: Mobile + Web folder reorg complete
BODY:
  CHANGED: <commit hashes of every bucket commit, one per line>
  MOBILE_BUCKETS_DONE: auth, onboarding, admin, flows, messages, profile, shared, business, client
  WEB_BUCKETS_DONE: system, support, legal, auth, marketing
  FILES_MOVED: <count from `git log --oneline --stat | grep -c rename` since brief start>
  IMPORTERS_UPDATED: <count of unique files edited that aren't renames>
  PROOF:
    - mobile bundle exit: 0  (last: `npx expo export --platform web`)
    - web build exit:    0  (last: `npm run build`)
    - web lint exit:     0  (`--max-warnings 0`)
    - npm audit:         0 high, 0 critical
    - zero-residue grep: 0 hits across both surfaces
  ACCEPTANCE:
    - ✅ Every screen in /tmp/reorg-mobile-screens-before.txt now under a subfolder of mobile/src/screens/
    - ✅ Every page in /tmp/reorg-web-pages-before.txt now under a subfolder of web/launch/src/pages/
    - ✅ Co-located .module.css files moved with their .jsx
    - ✅ MapScreen and MapScreen.web in same bucket
    - ✅ Deliverable written to AGENTS/claude/deliverables/reorg-mobile-web-<DATE>.md
  ISSUES: <NONE | listed in deliverable>
  NEXT_AGENT: qa-agent (smoke test app navigation on device)
STATUS: OPEN
---
```

Then update `STATUS.md`:
- Move "reorg" out of "Next Action" → into "Last Agent Run".
- Set `Session End Signal` to ✅ or 🔶 with the NEEDS-KIRA list.

---

## SECTION 9 — Deliverable

Write `AGENTS/claude/deliverables/reorg-mobile-web-YYYY-MM-DD.md` with:

1. **Before/after tree** — `ls mobile/src/screens/` and `ls web/launch/src/pages/` pre and post.
2. **Move table** — every `git mv old → new` row, plus how many importers were updated per file.
3. **Commit list** — every bucket commit's hash + message (one per row).
4. **Verification output** — paste the exit codes + last 10 lines of each build.
5. **Suspected dead code** — every file with zero importers found in Section 0.6.
6. **Decisions logged** — shared-CSS placement (Section 5B), any `pages/app/` cross-cuts.
7. **NEEDS-KIRA list** — verbatim with trigger IDs from Section 6.
8. **Total runtime** — start/end timestamps.

---

## SECTION 10 — Win condition (the gate that closes the brief)

All must be ✅, or the brief is not DONE:

| | Check | Pass condition |
|---|---|---|
| 1 | Mobile screens layout matches Section 5A | `ls mobile/src/screens/` shows only subdirs, no flat `.js` |
| 2 | Web pages layout matches Section 5B | `ls web/launch/src/pages/` shows only subdirs (+ optional `app/`, shared CSS if multi-bucket) |
| 3 | Mobile bundle green | `npx expo export --platform web` exit 0 |
| 4 | Web build green | `npm run build` exit 0 |
| 5 | Web lint clean | `npm run lint` exit 0, `--max-warnings 0` |
| 6 | No `npm audit` regression | high+critical count not greater than baseline |
| 7 | Zero-residue grep on both surfaces | 0 hits |
| 8 | All commits use `chore(reorg): ...` prefix | grep the log since brief start |
| 9 | Deliverable written | file exists at expected path |
| 10 | STATUS.md + SESSION_LOG.md updated | Layer 7 closed |

---

## What's explicitly OUT OF SCOPE

- Mobile component regrouping (`mobile/src/components/`) — separate brief.
- Backend reorg, marketing reorg, Roadmap cleanup — separate briefs.
- Renaming files (only moving). e.g. `Login.jsx` stays `Login.jsx` in its new home.
- Any feature work, copy edits, design tweaks, lint auto-fixes beyond what your moves require.
- Tonight's tech-beta dominoes (T1/T2/T3 in `BRIEF-technical-beta.md`). If both briefs are queued, **run reorg LAST** so the feature work isn't fighting moving paths. If a tech-beta task is mid-flight, **defer this brief** and write a BROADCAST to the bus saying so.

---

## Why this brief is bulletproof (Kira's read-once summary)

- Every command is pasted, not described.
- Every decision has a named NEEDS-KIRA exit so the runner never invents an answer.
- Every batch commits separately → any failed batch reverts in one `git reset`.
- The bundler runs after every batch → an import you missed shows up in 10 seconds, not after 40 moves.
- The runner builds its own importer map at runtime (Section 0.6) so the brief isn't relying on a stale snapshot.
- No content edits permitted → diff review is trivial (rename + import strings only).
- Out-of-scope folders enumerated by name → no scope creep into `marketing/`, `backend/`, etc.
- Hard rules (Section 3) match the orchestrator's verification-before-completion + systematic-debugging skills.
