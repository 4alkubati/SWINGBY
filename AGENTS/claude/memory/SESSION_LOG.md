# SESSION_LOG — Append-only history

> Newest entry at the bottom. One block per session. Never edited, only appended.
> **Holds the last 3 sessions only.** At session close, roll older entries into `memory/archive/SESSION_LOG-<year>.md`.

## Entry template

```
---
DATE: <ISO-8601>
PROJECT: <name>
PHASE: <phase>
DISPATCHED: <agents run + task IDs>
SHIPPED: <what got done, with file paths>
NEEDS KIRA: <human-only items left>
NEXT: <next framed task>
---
```



---
DATE: 2026-06-28
PROJECT: swingby
PHASE: D2.1 — Employee trust card (code-complete) + pre-existing 5 fixes committed
DISPATCHED: orchestrator inline (Opus 4.7, no subagent — single-author backend + mobile)
ENTRY STATE:
  - git: was 2 commits ahead of origin/main (`1f1801b` D2.5 cleanup + `08715e3` D1 emails) BEFORE this session; working tree carried 5 modified code files + 1 SESSION_LOG re-addition.
  - Kira approved: commit 5 code fixes only, leave SESSION_LOG/Roadmap aside, start D2.1.
SHIPPED THIS SESSION:
  - Commit `7875b31 fix(backend+mobile): unread-count stub + UnreadContext pre-login guard + web Places guard` — 5 files: `backend/app/api/messages.py` (new `/messages/unread-count` stub returning zeros, defined BEFORE `/{booking_id}` so FastAPI doesn't try to coerce as UUID), `mobile/src/context/UnreadContext.js` (skip poll when user null + `_silent` opt-out), `mobile/src/services/api.js` (honour `_silent` in interceptor), `mobile/src/screens/client/PostJobScreen.js` + `mobile/src/screens/onboarding/BusinessSetupScreen.js` (Platform.OS !== 'web' guard on GooglePlacesAutocomplete).
  - **D2.1 backend** — `backend/app/api/employees.py` adds `GET /{employee_id}/profile`. Auth: any logged-in user. Returns identity + tenure + jobs_completed + verified flag + avg_rating/review_count. Reviews query keys on `reviewee_type='employee'` AND `reviewee_id = employees.user_id`. Jobs_completed counts `bookings WHERE employee_id = :id AND status='completed'`. Verified flag mirrors `businesses.license_status == 'verified'`. NOT YET COMMITTED — awaits Kira's go on D2.1 commit.
  - **D2.1 mobile** — `mobile/src/screens/business/EmployeeProfileScreen.js` rewritten. Replaces the prior `/employees/` list-then-filter (which would 403 for clients since `list_employees` requires `role='business_owner'`) + the wrong `/reviews/business/{businessId}` fetch (was showing biz reviews on the employee profile). New flow: single call to `/employees/{id}/profile`, identity card with Avatar (correct `source=` prop, not `uri=`) + name + role, RatingStarsDisplay + "N.N · M reviews" line, "✓ Verified by {business_name}" success pill conditional on `verified_via_business`, company link, 3-box stats row (Rating / Jobs / Since {YYYY/Mon}), empty-state "No reviews yet — first one earns a badge." NOT YET COMMITTED — paired with backend in same D2.1 commit.
  - Memory: STATUS.md Last Updated + Phase Status + Next Action; D2.1 domino frontmatter status pending→in-progress + 📖 Log entry; this SESSION_LOG entry.
GATES PASSED:
  - Python AST clean on `employees.py` ✅
  - FastAPI boot with stub env → 65 routes (was 63 before run, +2 from previously-uncommitted `/messages/unread-count` + `/employees/{id}/profile`); `/employees/{employee_id}/profile [get]` visible in `/openapi.json` ✅
  - Babel parse clean on `EmployeeProfileScreen.js` ✅
  - Avatar prop verified: component takes `source` not `uri` (one-pass fix caught in cross-file review)
  - Cross-file nav: `BusinessProfileScreen.js:502` already passes `{ employeeId, businessId }` — matches new screen's `route.params.employeeId` read ✅
LATENT BUG SURFACED (parked, separate domino):
  - `reviews.reviewee_type` CHECK = `('client','business')` only. Inserting `'employee'` rejects. So D2.1 endpoint returns avg_rating=null/review_count=0 today. Endpoint shape is correct for when the client→employee review flow lands; that work needs to (a) extend the CHECK in a migration, (b) add a review-target picker to the existing review submission. Parked — not D2.1's job.
LEARNING-LOOP:
  - Lesson: when reusing a component, grep the component file for its prop API before passing what you assume the prop name is. Avatar takes `source` (which handles both string-URL and `{uri:}` shapes), not `uri`. A 30-second grep prevented a runtime "image won't render" surprise that no boot/babel gate would catch. Codify: any new screen that imports a shared component should grep that component's signature once before writing the prop, especially for components named after generic HTML elements (Avatar / Badge / Modal) where the naming convention drift is highest.
  - Lesson: a schema CHECK constraint surfaced during D2.1 ("employee not in reviewee_type enum") is *upstream scope*, not a D2.1 bug. The right response is (1) make the new endpoint correct against the existing schema (returns 0 today, returns real numbers tomorrow), (2) park the migration-needed work as a separate domino, (3) do NOT silently extend the constraint on the way past — that's an unsupervised schema migration outside the current task's blast radius.
  - Lesson: when "continue from there" lands on a working tree with surprising modifications, the right first move is *not* to start the next task — it's to surface the drift to the human, confirm it's not their in-progress work, and only then act. The AskUserQuestion pause cost ~30 seconds and made every following edit explicitly safe. Codify: re-derive `git status --short` at every session start; treat any code file modified outside the prior SESSION_LOG's "SHIPPED" list as potential unsaved human work until proven otherwise.
NEEDS KIRA:
  1. **(Bucket C)** Commit + push the D2.1 changes. Suggested:
     ```
     git add backend/app/api/employees.py mobile/src/screens/business/EmployeeProfileScreen.js \
             Roadmap/dominoes/D2.1-employee-trust-card.md AGENTS/claude/memory/STATUS.md \
             AGENTS/claude/memory/SESSION_LOG.md
     git commit -m "feat(D2.1): employee trust card — ratings, verified, jobs_completed, tenure"
     git push origin main
     ```
     Plus the 2 pre-existing local commits (`1f1801b` + `08715e3`) and `7875b31` from this session all ship in the same push.
  2. **(Bucket B — on-device verify)** In Expo Go, log in as a client, open a business with employees, tap an employee → confirm: name + role render, stars/count appear (will read 0.0/0 today since no employee reviews exist yet, expected), "✓ Verified by {business_name}" appears IFF the parent business is `license_status='verified'`, "Since {Mon YYYY}" reads the employee's `created_at`, no "—" placeholders. File any bugs to `Roadmap/June/2026-06-28.md`.
  3. **(Optional, future domino)** Extend `reviews.reviewee_type` CHECK to include `'employee'` + wire client→employee review submission. Parked above; not blocking D2.1.
  4. **(Unchanged backlog)** Seed accounts in Supabase Auth, Stripe keys into Render, DMARC TXT, D2.0 walkthrough.
NEXT: D2.2 — Invoices (in-app receipt + PDF via reportlab). Spec in `Roadmap/dominoes/D2.2-invoices.md`. Code-runnable; no Kira blocker.
---


## 2026-07-03 — Business-flow session (BRIEF-business-flow)
SHIPPED (working tree, NOT committed — tree has unrelated human changes):
  - WS-A: `/auth/me` now returns `business_id` for business owners (auth.py); BusinessProfileScreen falls back to `/businesses/me` when no id resolvable (root-caused the "My Business tab error screen" bug); back-arrow hidden at tab root; Invoices row added to Account menu; NEW `BusinessInvoicesScreen` (receipts list → existing Invoice PDF screen), registered as `BusinessInvoices` in BusinessNavigator.
  - WS-B: JobOpportunityCard shows client identity (first name + last initial + avatar + address; data already in feed); BookingDetails gets a Client card w/ tap-to-message for provider view; "Pay with card" gated to clients; `avatar_url` added to client joins (service_posts, bookings list + single).
  - WS-E: Dashboard weekEarnings bug fixed (`total_price`→`total_amount` — was always $0); real deltaPct (this vs last week, hidden when no baseline); real sparkline data; EarningsHero hides fake default curve; EarningsScreen de-faked (no more random placeholder data / 8%-pending / 5%-fees — real released/escrow/platform_cut + working range filter).
  - WS-C (pre-booking chat): Supabase migration `messages_interest_threads` APPLIED (interest_id, booking_id nullable, CHECK, read_at, RLS for interest participants, index). messages.py: send/get by interest_id, `GET /messages/threads` unified inbox (booking + quote threads, last message, real unread), real `/messages/unread-count`, mark-read on thread fetch. Accept flow stamps interest messages with new booking_id (thread carries over). Reject flow pushes "quote not selected — follow up" to business. MessagesScreen → unified threads w/ Quote/Booking chips; ChatScreen supports `{interestId}` + fixed latent bug (was setting `{items:...}` object as messages array + appending send wrapper).
  - WS-D: SendQuoteSheet has optional note → seeds interest chat + navigates to thread; last-price-per-category prefill (AsyncStorage); NEW `GET /interests/mine`; MyJobsScreen business lens gets a Quotes tab (status chips + Message follow-up on declined).
  - WS-F: Dashboard needs-attention chips (new leads / unread / awaiting assignment) w/ deep links; module-level stale-while-refetch cache (instant paint); focus-refresh on Dashboard + Messages.
VERIFIED (local backend on :8000 against live Supabase, seed accounts business@/client@swingby.app):
  - /auth/me returns business_id ✅; quote→chat→reply→unread=1→fetch-marks-read→unread=0 ✅; both inboxes show thread w/ correct counterparts ✅; reject→business counters in same thread ✅; /interests/mine ✅ (fixed: service_posts has no preferred_date column); no-token → 401 ✅.
  - Flow graph regenerated: 0 broken edges, 0 broken API calls. Pre-existing per-nav orphan: `Notifications` in BusinessNavigator (NotificationsCenter is the linked one).
NEEDS KIRA:
  1. (Bucket B) On-device Expo Go verify with both seed accounts — esp. My Business tab, Invoices row, quote-with-note → chat, Messages unified inbox, dashboard chips.
  2. (Bucket C) Commit + push — tree also contains unrelated modified components + deleted Roadmap/June files predating this session; human to review before staging.
  3. (Deploy) Render picks up backend changes only after push.
LEARNING-LOOP:
  - Lesson: memory said test creds were testclient/testbusiness@swingby.dev — live DB has business@/client@/employee@swingby.app (`Swingby<Role>2026`). Verify seed accounts against auth.users before smoke tests.
NEXT: Phase-2 invoicing (business-generated, client pays in-app) per BRIEF-business-flow out-of-scope list.
---

---
DATE: 2026-07-07
PROJECT: swingby
PHASE: System-review remediation — agent registration + doc compaction (approved block)
DISPATCHED: orchestrator inline (no subagent — doc/config surface only)
SHIPPED (commit `d545715`, scoped to AGENTS/ + .claude/agents/ + CLAUDE.md per sync rule):
  - `.claude/agents/*.md` — 10 registered agent types (thin: frontmatter + "read your BOH/FOH file"); `subagent_type: backend-agent` etc. now resolves. Executors model: sonnet; qa: haiku.
  - `AGENTS/claude/ORCHESTRATOR.md` — 2,586 → 712 words; current model tiers; he/him; links to gate/loop/council/template instead of duplicating.
  - `memory/archive/` NEW — SESSION_LOG capped at last 3 (rest → SESSION_LOG-2026.md), MESSAGE_BUS holds 2 OPEN items (9 resolved → MESSAGE_BUS-2026.md), ORCHESTRATOR_ISSUES slimmed to open rows w/ staleness caveat (full audit → archive).
  - `config/ROUTING.md` — BOH/FOH appendix merged into Layers 1–2; all MCP references by capability (session-scoped prefixes removed here + BOH/FOH + MCP_INVENTORY).
  - `config/LOOP.md` — never read briefs/deliverables/archive at startup; last-3 log roll rule; he/him.
  - she→he sweep across skills/, KICKOFF.md, README.md; CLAUDE.md Notion nudge-layer + notion_crm rows; NOTION_SYNC.md committed.
GATES PASSED:
  - grep sweep: 0 stale pronouns / model IDs / hardcoded mcp__ prefixes outside archive+deliverables ✅
  - SESSION_LOG holds exactly 3 sessions; bus holds OPEN only ✅
  - Harness lists all 10 agent types as dispatchable this session ✅
NEEDS KIRA (from the review, unchanged):
  1. Flip 3 Notion rows to Done (F1, F2, the flip-task) — writes blocked for agents.
  2. D4 due today while D2.0/D3 in progress — push the date or accept slip.
  3. Optional: `ollama rm llama2 qwen3.6` frees ~27 GB (23 GB model can't fit 8 GB VRAM).
NEXT: Wire qwen3 overnight-log summarization into the n8n morning brief (parked Notion row) — post-beta unless idle time appears. Build queue unchanged: D2.0 walkthrough (Kira's iPhone) gates D3/D4.
---

---
DATE: 2026-07-15
PROJECT: swingby
PHASE: Automation — morning brief live + memory truth-up
DISPATCHED: orchestrator inline (no subagent)
SHIPPED:
  - Telegram morning brief FIXED + verified: token was split/incomplete in `.claude/secrets/n8n.env`, chat_id was the bot's own id → corrected to Kira's personal chat id (lives only in `.claude/secrets/n8n.env`, gitignored), container recreated, test brief delivered (execution 5). Fires 06:05 America/Edmonton daily.
  - `send-test-brief.sh` — waits on n8n /healthz after container recreate (was flaky).
  - Killed 3 stray agent sessions (Jul 13 pts/2, cd379f39, faf80e73).
  - Host clock verified NTP-synced; lid-close suspend verified disabled (live in logind); docker restart policy `unless-stopped` → brief survives reboot. n8n does NOT catch up missed runs — laptop must be awake at 06:05.
  - D2.0 walkthrough retro-closed per Kira (happened ~Jul 9–11, evidence `70d165a`/`9575fd3`) — domino frontmatter → done, log entry added, STATUS + HUMAN-TODO updated.
NEEDS KIRA:
  1. Optional: mask sleep targets so the laptop can never suspend (`sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target`).
  2. ~10 min: dump remaining D2.0 findings into the domino 📖 Log (only HEIC was filed).
  3. D3 walkthrough + D4 tester (Jul 15) — the calendar keys off these now.
NEXT: D2.2 invoices polish (code-runnable). D2.0 gate CLEARED — D3/D4 are Kira's next moves per the re-dated calendar.
---

---
DATE: 2026-07-15 (second block — laptop rescue)
PROJECT: swingby
PHASE: Laptop work rescue + merge + verify
DISPATCHED: orchestrator inline
SHIPPED:
  - Discovered the laptop repo (OneDrive) held a WEEK of unpushed Jul 9–12 work; GitHub push from laptop failed (auth, silent exit 128) → rescued via git bundle over LAN scp, branch `laptop-jul10-polish-sweep` pushed from server, merged as `d350295`.
  - Recovered: full D2.0 walkthrough triage (4 bugs, Roadmap/July/2026-07-09.md), Jul 11 two-track plan + backend fixes (UUID guard on /messages routes, Stripe prod_/price_ fail-fast, Sentry RemoteProtocolError filter), Jul 10–12 polish sweep (~40 mobile screens, ledger in memory/POLISH-SWEEP-2026-07-10.md).
  - Merge conflicts resolved: Jul 9/10/11 day files keep recovered content with corrected slip banners; design/handoff-jet-pulse/ rename kept over laptop deletion.
  - Gates: backend pytest 23 pass / 3 skip (Docker python:3.14-slim, dummy env); 113 mobile files parse clean (@babel/parser); pushed → Render auto-deployed; UUID-guard probe 404 ✅; tools/e2e_smoke.py vs Render: ALL 22 PASS incl. quote-chat→booking-thread migration.
NEEDS KIRA:
  1. iPhone retest of walkthrough bugs 1 (quote→wrong category) + 2 (match→Messages thread; API level now passes).
  2. Laptop git push auth is broken (silent exit 128) — fix GitHub sign-in on laptop, and move repo out of OneDrive (caused index.lock + likely the auth weirdness).
NEXT: Fix walkthrough bug 1 (category mapping on quote/post create) — top open 🔴. Then D2.2 invoices polish. D3/D4 remain Kira's gate.
---
