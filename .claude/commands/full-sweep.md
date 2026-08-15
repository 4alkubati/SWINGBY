---
description: Repo-wide bug + inconsistency audit. Reads every line and every comment in a shard, verifies each finding by trying to refute it, writes a SENTINEL-format report to ~/brain/inbox/.
argument-hint: "[money|auth-privacy|backend-rest|mobile|web|db|meta]  (omit = all seven, money first)"
---

# /full-sweep — repo-wide bug + inconsistency audit

You are auditing SwingBy for a public-beta cut. Real money and real PII move
through this repo. The bar is a top-tier reviewer who reads code, not a linter
that pattern-matches.

**Argument:** `$ARGUMENTS` — one shard name, or empty for all seven.

---

## 0. Read-only. No exceptions.

No edits, no writes inside the repo, no commits, no branch, no worktree, no
migration, no `make`, no test run that mutates state. The **only** file you
create is the report in `~/brain/inbox/`. If you find yourself wanting to fix
something, write the fix as a one-line `Fix:` in the finding and move on.

Read-only shell is fine and expected: `git ls-files`, `git log`, `git blame`,
`grep`, `rg`, `wc`, `graphify query`.

---

## 1. Fan out — the repo does not fit in one context

1163 tracked files, ~148k LOC. Measured at `97c146c` (2026-08-15):

| Area | Files | LOC |
|---|---|---|
| `mobile/src` | 272 | 60,252 |
| `backend/app` | 71 | 23,666 |
| `backend/tests` | 67 | 21,779 |
| `web/pre-launch/src` | 161 | 18,926 |
| `web/launch/src` | 125 | 9,794 |
| `web/admin/src` | 35 | 7,128 |
| `tools` | 22 | 5,145 |
| `supabase` | 20 | 2,949 |
| `.github` | 8 | 711 |
| `workers` | 2 | 141 |

Seven shards below. **Run them one at a time** — this box goes to load 24 with
three concurrent agents (that is a measured fact, not a guess). If the argument
is empty, work the shards in listed order; `money` runs first and alone because
it has the highest blast radius.

Inside a shard, work the sub-passes in order and finish each before starting the
next. A sub-pass is sized so you can genuinely read every line rather than
sample. **If you catch yourself skimming, the pass is too big — split it and say
so in the report.** Silently sampling and reporting as if you read everything is
the single worst failure mode of this command.

### Shard `money` — ~9k LOC, runs first, runs alone
```
backend/app/services/escrow.py
backend/app/services/payment_triggers.py
backend/app/services/refunds.py
backend/app/services/budget_settlement.py
backend/app/services/payouts.py
backend/app/services/credits.py
backend/app/services/stripe_connect.py
backend/app/services/stripe_payment_sheet.py
backend/app/services/stripe_service.py
backend/app/api/payments.py
backend/app/api/payments_stripe.py
backend/app/api/payments_offplatform.py
backend/app/api/payouts.py
backend/app/api/invoices.py
backend/app/api/subscriptions.py
backend/app/api/disputes.py
mobile/src/services/acceptAndPay.js
mobile/src/services/nativePay.js
mobile/src/components/PaySheet.js
mobile/src/screens/profile/PaymentMethodScreen.js
mobile/src/screens/business/WalletScreen.js
mobile/src/screens/business/BusinessInvoicesScreen.js
mobile/src/screens/shared/InvoiceScreen.js
mobile/src/screens/client/MyDisputesScreen.js
mobile/src/screens/flows/DisputeFlowScreen.js
```
Also read, as evidence only (they are not the subject, but they encode the
contract and a wrong mock hides a real bug — see §5): `backend/tests/test_escrow_ledger.py`,
`backend/tests/test_no_staged_release_claim.py`, `backend/tests/test_budget_settlement.py`,
`mobile/src/services/__tests__/acceptAndPay.test.js`, and the payment tests under
`mobile/src/__tests__/`.

`backend/app/services/escrow.py` is the **authority** for every rate, split and
penalty. Where `CLAUDE.md`, `docs/`, or user-facing copy disagrees with it, the
doc or the copy is the finding — not the code. The reverse claim shipped once
and had to be pulled.

### Shard `auth-privacy` — ~8k LOC
```
backend/app/api/auth.py
backend/app/deps.py
backend/app/privacy.py
backend/app/text_safety.py
backend/app/limiter.py
backend/app/middleware/request_id.py
backend/app/services/session_security.py
backend/app/services/contact_masking.py
backend/app/services/audit.py
backend/app/services/moderation.py
backend/app/services/content_moderation.py
backend/app/services/url_safety.py
backend/app/services/image_sniff.py
backend/app/services/visibility.py
backend/app/api/moderation.py
backend/app/api/me.py
backend/app/api/admin.py
mobile/src/services/auth.js
mobile/src/services/authLink.js
mobile/src/context/           (all 3 files — auth/session state)
```
Two rules from `CLAUDE.md` that are load-bearing here, so a violation is a real
finding: blocks are stored one-way but must be **enforced symmetrically** via
`visibility.blocked_pair_ids`; `hidden_at` is a **soft hide** and every read path
over `messages` / `reviews` / `service_posts` / `booking_photos` must filter
`hidden_at is null`. A new read path missing that filter is a BLOCKER.

### Shard `backend-rest` — ~15k LOC, two passes
Everything in `backend/app/**` not claimed by `money` or `auth-privacy`.
- **Pass A — API:** `api/{admin,analytics_export,auto_bidding,booking_events,booking_location,booking_photos,bookings,businesses,contact,employees,google_reviews,interests,proof_of_work,push_tokens,reviews,service_posts,uploads,waitlist}.py`
- **Pass B — core + services:** `main.py`, `config.py`, `database.py`, `supabase_client.py`, `categories.py`, `logging_config.py`, and `services/{analytics,approvals,email,expiry_sweep,geocoding,push,search_index}.py`

### Shard `mobile` — ~48k LOC non-test, five passes
`mobile/src/**` minus the files already claimed by `money` and `auth-privacy`.
- **Pass A — plumbing:** `services/` (31 remaining), `hooks/`, `context/`, `navigation/`, `utils/`, `config/`, `constants/`, `theme/`
- **Pass B — i18n:** `i18n.js` + `i18n-locales.js` (EN/FR/AR key parity is a first-class check — see §4)
- **Pass C — components:** `components/` (84 files, 13.1k LOC)
- **Pass D — client + flows + messages screens:** `screens/{client,flows,messages}/`
- **Pass E — business + auth + onboarding + profile + shared + admin screens:** `screens/{business,auth,onboarding,profile,shared,admin}/`

Tests under `mobile/src/__tests__/` and `screens/**/__tests__/` are read as
evidence in whichever pass covers the code they test, per §5.

### Shard `web` — ~36k LOC, three passes
- **Pass A:** `web/pre-launch/src/**` (161 files) + its `vite.config.*`, `package.json`
- **Pass B:** `web/launch/src/**` (125 files) + config, and its EN/FR/AR locale files
- **Pass C:** `web/admin/src/**` (35 files) + `workers/waitlist/{index.js,wrangler.toml}`

`web/admin/` is **not deployed** — admin review is in-app via `ReportQueueScreen`.
Do not file "the admin dashboard is unreachable" as a bug; do file code in it
that would break if it *were* deployed, marked `RISK`.

### Shard `db` — ~3k LOC
```
supabase/migrations/*.sql        (18 files)
supabase/APPLY-2026-07-25-all-three.sql
supabase/APPLY-2026-07-26-both.sql
docs/APPLY-2026-07-20.sql
docs/*.sql                       (the loose migration/backfill scripts)
docs/swingby_database_schema.md
```
Reconcile against what the backend actually reads: every table/column the
migrations create should be reachable from `backend/app/`, and every
table/column `backend/app/` selects, inserts or filters on should exist in the
migrations. Both directions are findings. Check every `ENABLE ROW LEVEL
SECURITY` has at least one matching `CREATE POLICY` — a table with RLS on and no
policy is silently deny-all.

### Shard `meta` — ~7k LOC, two passes
- **Pass A — build, CI and deploy config:**
```
.github/workflows/{backend,mobile,web-ci,web-launch-ci,web-launch-deploy,web-prelaunch-deploy}.yml
Makefile
backend/{Dockerfile,.dockerignore,render.yaml,ruff.toml}
backend/{requirements.txt,requirements-dev.txt}
backend/scripts/**
tools/**                         (22 files, incl. tools/walkthrough/)
.gitignore  .gitattributes  CNAME
```
An env var read in code but absent from CI and from `render.yaml` is a `RISK`
finding here, not a nit — it is how a payment path dies in production only.

- **Pass B — docs and policy:**
```
CLAUDE.md
README.md
WORKSPACE-MAP.md
docs/**.md                       (69 files — API.md, SECURITY.md, DEPLOY.md, ROLLBACK.md, FLOW_GRAPH.md first)
privacy-and-security/**          (13 files — the user-facing legal text)
```
`docs/API.md` vs the routes that actually exist in `backend/app/api/` is a
high-yield check here and belongs to this shard, not `backend-rest`. Same for
`privacy-and-security/` vs what the code actually collects, retains and shares:
a policy promising something the code does not do is a `BLOCKER` before a public
beta, not a copy nit.

### Deliberately out of scope

Say so in the report header rather than silently skipping. Not audited by any
shard: `design/`, `marketing/`, `Roadmap/`, `.claude/`, `.vscode/`,
`credentials/` (contents are gitignored — **never read it**).

`backend/tests/` (67 files, 21.8k LOC) is **not** a shard of its own. It is read
as evidence inside the shard that owns the code under test, per §5 — a test that
encodes a wrong contract is a finding filed against the code, not against the
test file. If you want the test suite audited on its own terms, that is a
separate run and it is not this command.

---

## 2. Comments, docstrings and docs are first-class evidence

Read every comment. A comment, docstring, or `CLAUDE.md`/`docs/` claim that
**contradicts the code beneath it is itself a reportable finding**, severity
`INCONSISTENT` at minimum and `BROKEN` when a reader acting on it would break
something. This repo's comments carry load-bearing history — `payment_triggers.py`
docstrings, the `mobile.yml` note that every green Mobile CI before that commit
was green on an empty job — so a stale one actively misleads the next session.

Also report:
- `TODO` / `FIXME` / `XXX` / `HACK` that a later commit already resolved (dead
  warning) or that was silently abandoned (`git log -S` the surrounding line to
  tell which).
- A comment describing behaviour in the future tense ("will be", "once we") for
  something that already shipped, or vice versa.
- A docstring documenting a parameter, return shape, or error the function no
  longer has.

Do **not** report a comment merely for being terse, informal, or long.

---

## 3. What to hunt — seeded from what this codebase has actually produced

This is not a generic checklist. Each class below has produced a confirmed
finding in this repo before.

**Invariant violation.** A row-count or uniqueness assumption the rest of the
code depends on, silently broken upstream. *Confirmed instance:* accept-interest
inserted a second `payments` row for one `booking_id`, so every downstream
`.single()` call errored and the booking could never be completed.

**Wired but never called.** A function that is implemented, unit-tested, and has
zero non-test callers — so the behaviour its tests prove does not happen in
production. Prove absence with `grep -rn` across the whole repo, not the graph
(see §6). *Confirmed instance:* `budget_settlement.settle_on_date_confirmed`
existed with tests and no callers; it was deleted, and
`backend/tests/test_no_staged_release_claim.py` now guards its return.

**Two implementations that disagree.** The same rule expressed twice, where the
live path and the tested path differ. *Confirmed instance:* the raw-SQL
`expire_old_service_posts()` pg_cron job vs the refund-aware Python `sweep_once`
— the SQL one skips the refund.

**Copy that contradicts the code.** User-facing strings, especially money and
cancellation terms. `mobile/src/screens/shared/TermsOfServiceScreen.js` must
match `escrow.compute_cancellation_split()` verbatim — that text is what the
client legally agreed to. Any pay sheet, toast, or marketing page quoting a
different window, rate, or penalty is a finding.

**Failure reported as success.** An error path swallowed into a success toast,
a `catch` that logs and returns `{ok: true}`, an HTTP 4xx/5xx not surfaced.
*Confirmed instance:* a dispute 404 swallowed into a "Submitted" toast.

**Tests or CI that cannot fail.** A job gated on a script that does not exist, a
matrix that resolves to zero jobs, a test asserting on a mock rather than the
code, `continue-on-error` on the step that was supposed to be the gate.

**Cross-boundary drift.** Backend response shape vs the mobile/web parse of it —
including the axios-unwrapping class of bug (`res.data.items` against an already
unwrapped client returns `undefined`, and `[]`/`false` forever). Also: i18n key
present in EN and missing in FR/AR; an env var read in code but absent from
`/health` and from CI (e.g. `STRIPE_WEBHOOK_SECRET`); `docs/API.md` vs the routes
that exist.

**Money correctness.** Cents/float mixing, rounding direction, sign errors,
double-charge, an orphaned `stripe_payment_intent_id`, a platform cut taken where
the ladder says none is taken.

**RLS / privacy.** A migration enabling RLS with no matching policy; masking
applied on one sibling read path and not the others; a new read path over a
`hidden_at` table missing the filter; a one-way block enforcement.

### Already settled — do not re-report these as live bugs

Re-reporting a corrected myth as a finding is worse than missing one, because
someone may "fix" working code back into the wrong shape. Verify against the
code, and if the code matches the note below, it is not a finding:

- **There is no staged 50/50 escrow release.** Money is charged before service
  and released on completion/approval. `CLAUDE.md` said otherwise until
  2026-07-29; that line was the bug, and it is corrected.
- **Cancellation ladder** is 100 / 100 / 75 / 50 (no date, `early`, `late`,
  `no_show`), business-cancels always 100% refund, and **no platform cut is taken
  on a cancellation**. Confirm against `escrow.compute_cancellation_split()`.
- **Nothing is charged when a client posts a job.** The charge-at-post trigger is
  wired but deliberately gated OFF in `api/service_posts.py`; `payment_started`
  is always `false`. Turning it on needs card-on-file, which does not exist here.
  The `expiry_sweep` refund path being a no-op today is intentional, not dead
  code — do not file it as dead.
- **`content_moderation.py` is not a profanity filter, on purpose.** General
  profanity only FLAGS. Do not file "'shit' is not blocked".
- **`web/admin/` is not deployed.** Not a bug on its own.
- **5 JSX files partially extract in graphify** because of a bare `&` in JSX text
  (e.g. `BusinessProfileScreen.js:698` "Services & pricing"). Valid React, a
  tree-sitter quirk. Not a syntax error.

---

## 4. Evidence discipline — the rule that separates this from slop

Every finding ships in exactly this shape:

```
## [SEVERITY] [CATEGORY] one-line claim
path/to/file.py:120-134
<what is wrong, in prose — two to five sentences>
Proof: <the trace. Quoted code, the grep that shows zero callers, the two
       values that disagree and where each comes from. Enough that a reader
       can refute it without opening the repo.>
Fix: <one line, the smallest correct change>
```

**Severity** — `BLOCKER` (loses money, leaks PII, or makes a core flow
impossible — must not ship to beta) · `BROKEN` (a real user path fails or
silently does nothing) · `RISK` (works today, fails on plausible input or
config) · `INCONSISTENT` (code disagrees with code, or with a comment/doc/copy).

**Category** — `[WRONG ALGORITHM]` `[WRONG NUMBERS]` `[SECURITY]` `[DEAD CODE]`
`[DRIFT]` `[COPYWRITING]`.

### Hard bans

- **No style or formatting nits.** `ruff` and `black` already gate CI. Naming,
  line length, import order, f-string vs `%` — none of it.
- **No "consider adding tests / type hints / docs / error handling"** as a
  finding on its own. A *missing* test is only reportable when you can name the
  bug it would have caught, and then the bug is the finding.
- **No finding without a concrete failure scenario** naming the inputs and the
  wrong output. "This could be a problem if…" without inputs is not a finding.
- **No reporting one root cause as N findings.** If fixing one line fixes three
  symptoms, that is one finding with three symptoms listed. The prior audit's
  *"this is the same underlying bug as Problem A, not a second bug"* is the
  standard to hold.
- **No speculating about code you did not read.** If a pass got too large, say
  which files you did not read, in the report.

---

## 5. Two passes. Never collapse them.

The house `two-stage-review` skill
(`~/brain/10-swingby/agents/claude/skills/two-stage-review.md`) exists for
reviewing an agent's task output — spec compliance, then quality. It is a
different instrument. The audit's two passes are defined here:

**Pass 1 — find.** Read every line in the sub-pass. Draft findings freely; a
draft costs nothing. Do not self-censor for confidence yet.

**Pass 2 — kill.** Take each draft and *actively try to refute it*. Default to
refuted when you cannot close the gap.
- Claimed "no callers"? `grep -rn` the bare name **and** the module-qualified
  form (`escrow.compute_x`, `from .escrow import compute_x`) across the repo
  including `web/`, `tools/` and `.sql`.
- Claimed a branch is reachable? Name the request that reaches it, and check no
  guard above returns first.
- Claimed a value is wrong? Show both values and the file:line each comes from.
- Claimed a test proves the contract? Check the test is not asserting on a mock
  that encodes the same wrong shape. Three test files once mocked the same wrong
  response shape, so 512 green tests never saw a BLOCKER.

Survivors ship marked **CONFIRMED**. A finding you believe but cannot fully prove
from code alone ships as **PLAUSIBLE** with the gap stated in one line (the
2026-07-26 money audit's *"code-only audit; I could not query live Supabase"* is
the model). Refuted drafts are dropped — but list the **three strongest
refutations** at the end of the report, so the next reader knows what was already
ruled out and does not re-derive it.

---

## 6. Locating code — graph first, grep to confirm

`graphify query "how does escrow release" --budget 1500` and
`graphify affected "<symbol>"` are far cheaper than repeated grep sweeps. Use
them to decide *what to read*. They return `file:line`, not truth.

⚠️ **`affected` under-reports module-qualified calls, and it has already
mattered.** It returned 2 callers for `compute_completion_release_cents`; `grep
-rn` returned 3, and the missed one (`api/proof_of_work.py:302`, called as
`escrow.compute_...`) carried the identical money bug. **For anything that moves
money or claims "no callers", confirm the caller list with `grep`.**

`docs/FLOW_GRAPH.md` stays the authority for screen↔screen navigation, route
coverage and orphan questions — read it before scanning screen files.

If `graphify-out/` is stale or absent, `graphify update .` costs ~60s and zero
tokens. That is a read-only rebuild of a gitignored directory and is permitted.

---

## 7. Output

Write to `~/brain/inbox/swingby-sweep-YYYY-MM-DD.md` (today's date). If the file
exists, append a new shard section rather than overwriting — a full run is seven
appends.

Header, first thing in the file:

```markdown
---
group: build
project: swingby
hub: "[[MOC-Build]]"
tags: [build, audit, sweep]
---
# Full sweep — YYYY-MM-DD

HEAD: <sha>  ·  branch: <branch>  ·  read-only, nothing modified.

**Shards run:** <names>
**Shards NOT run:** <names, or "none">
**Files not fully read:** <list, or "none — every file in every shard read line by line">
```

Then, per shard: findings ordered `BLOCKER` → `BROKEN` → `RISK` →
`INCONSISTENT`, each in the §4 shape, `CONFIRMED` before `PLAUSIBLE` within a
severity. End each shard with `### Strongest refutations` (the three drafts you
killed and why).

Close the file with a **one-liner**: the single most important thing found, in
one sentence, the way the 2026-08-04 sweep opens with *"17 of 18 were real."*

If a shard produces zero findings, say so plainly and say what you read. That is
a legitimate result and far more useful than padding.

### After a full run

Print to the session, not the file: the count by severity, the report path, and
the top three BLOCKERs as one line each. Nothing else.
