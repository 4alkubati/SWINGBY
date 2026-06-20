# ROUTING — Task → Agent → MCP map

> Hardcoded routing rules. Orchestrator uses this to dispatch — never guesses.
> If a task type is not listed, add it here BEFORE dispatching.

---

## Layer 1 — Task keywords → Primary agent

| Task contains keywords | Primary agent | Secondary | Notes |
|---|---|---|---|
| endpoint, route, API, FastAPI, Express, server, backend | backend-agent | qa-agent | qa tests after build |
| component, page, screen, UI, React, Native, Tailwind, frontend | frontend-agent | qa-agent | qa tests after build |
| schema, migration, table, RLS, SQL, index, database | database-agent | security-agent | sec checks RLS on every new table |
| audit, security, vulnerability, secrets, RLS check, CVE | security-agent | — | runs last in every phase |
| test, bug, QA, regression, smoke, e2e | qa-agent | — | runs after backend or frontend |
| plan, refactor, architecture, design decision | orchestrator | council | use Plan subagent |
| documentation, README, CLAUDE.md, docs | owner-of-code | — | backend or frontend depending on file |

---

## Layer 2 — Agent → Owned MCPs

| Agent | Primary MCPs | Skills | Forbidden tools |
|---|---|---|---|
| orchestrator | `mcp__scheduled-tasks__*`, `mcp__session_info__*`, `mcp__cowork__*`, `mcp__plugins__*`, `mcp__skills__*`, `mcp__mcp-registry__*` | consolidate-memory, schedule, init | Direct code edits (delegate to subagents) |
| backend-agent | `mcp__supabase__execute_sql`, `mcp__supabase__deploy_edge_function`, `mcp__supabase__get_logs`, `mcp__cloudflare__workers_*`, `mcp__cloudflare__kv_*`, `mcp__cloudflare__r2_*`, web_fetch | — | Schema-defining migrations (database-agent only) |
| frontend-agent | `mcp__cowork__create_artifact`, `mcp__Claude_in_Chrome__navigate` (preview), `mcp__Claude_in_Chrome__get_page_text` (preview) | docx, pdf (design specs only) | API calls outside services layer; direct DB access |
| database-agent | `mcp__supabase__apply_migration`, `mcp__supabase__list_tables`, `mcp__supabase__list_migrations`, `mcp__supabase__get_advisors`, `mcp__supabase__list_extensions`, `mcp__cloudflare__d1_*`, `mcp__cloudflare__hyperdrive_*` | — | Application logic; UI; auth code |
| security-agent | `mcp__supabase__get_advisors`, `mcp__supabase__get_logs`, `mcp__cloudflare__*` (read-only), WebSearch (CVE lookups) | security-review, review | Writing app code (recommend fixes only) |
| qa-agent | `mcp__Claude_in_Chrome__*` (full browser), `mcp__supabase__execute_sql` (read-only), `mcp__cloudflare__*` (logs only) | review | Schema edits; code edits (file bugs only) |

---

## Layer 3 — Cross-cutting (any agent may use)

| Tool | Use for |
|---|---|
| `mcp__57a2c292-...__notion-*` (Notion) | Reading specs, writing summaries, task tracking |
| WebSearch | Researching current best practices, library docs |
| `mcp__mcp-registry__search_mcp_registry` | Finding new connectors when current ones can't do the job |
| docx / xlsx / pptx / pdf skills | Final deliverables only — never internal scratch |

---

## Layer 4 — Fallback chain (when an MCP fails)

```
1. Retry same MCP once with 5s backoff.
2. If still failing → emit BLOCKED message to bus with the exact error.
3. Orchestrator consults MCP_INVENTORY.md for fallback.
4. If no fallback exists → escalate to user with: failed tool, attempted retries, what would unblock.
```

Specific fallbacks:

| Primary fails | Fallback | Notes |
|---|---|---|
| Supabase down | Cloudflare D1 (read-only check), `WebSearch` for status page | Cannot mutate schema while down |
| Cloudflare down | Notion fetch (read docs only), retry queue | Notify user |
| Chrome MCP unavailable | `mcp__computer-use__*` (slower, pixel-level) | Frontend preview only |
| Notion unavailable | local memory files only | Disable PM sync |

---

## Layer 5 — Dispatch template (Orchestrator uses this)

When Orchestrator dispatches a task, it writes this exact REQUEST to the bus:

```
---
ID: <timestamp>
FROM: orchestrator
TO: <agent-name>
TYPE: REQUEST
REF: <PLAN.md task ID>
PRIORITY: <CRITICAL | HIGH | NORMAL | LOW>
TIMESTAMP: <ISO-8601>
SUBJECT: <one-line task title>
BODY:
  GOAL: <one sentence>
  INPUTS:
    - <file path or message ID>
    - <file path>
  CONSTRAINTS:
    - <hard rules — auth, RLS, no hardcoded secrets, etc.>
  ACCEPTANCE:
    - <measurable definition of done>
  MCPs ALLOWED: <from Layer 2 only>
  DEADLINE: <turn count or wall time>
STATUS: OPEN
---
```

---

## Layer 6 — When to invoke Council (escalate to multi-reviewer)

| Trigger | Council members |
|---|---|
| Architecture decision affecting >2 agents | Plan + general-purpose + code-reviewer |
| Security finding CRITICAL | security-agent + Plan + general-purpose |
| Phase completion gate | qa-agent + security-agent + general-purpose |
| Conflicting agent reports | all involved agents + Plan |

Quorum: 2/3 approve = proceed. Otherwise → user.

---

## NEW AGENTS — BOH / FOH roster (agent-os kit)

> The kitchen split. BOH = technical (hidden). FOH = the image the customer sees.
> Every dispatch still passes all 7 layers of `DISPATCH_GATE.md`.

### Layer 1 additions — Task keywords → Primary agent

| Task contains keywords | Primary agent | Track | Secondary |
|---|---|---|---|
| screen, Expo, React Native, app.json, eas, navigator, mobile | mobile-agent | BOH | qa-agent |
| mockup, design token, brand, UI spec, color, typography, a11y | design-agent | BOH | frontend/mobile implements |
| social, content, post, campaign, waitlist, beta recruit, SEO, ad | marketing-agent | FOH | — |
| press, pitch, partnership, statement, reputation, outlet, journalist | pr-agent | FOH | — |
| inbox, email triage, morning brief, schedule, calendar, admin, "what's up" | assistant-agent | FOH | — |

### Layer 2 additions — Agent → Owned MCPs

| Agent | Track | Primary MCPs | Skills | Forbidden |
|---|---|---|---|---|
| mobile-agent | BOH | `mcp__workspace__web_fetch`, WebSearch, `mcp__Claude_in_Chrome__*` (preview), Notion | — | schema, backend routes, security policy |
| design-agent | BOH | `mcp__cowork__create_artifact`, `mcp__visualize__*`, WebSearch | pptx, pdf | production code edits |
| marketing-agent | FOH | WebSearch, web_fetch, `mcp__Claude_in_Chrome__*`, Notion | docx, pdf | sending unapproved; code/infra |
| pr-agent | FOH | WebSearch, web_fetch, `mcp__Claude_in_Chrome__*`, Notion | docx, pdf | public statements unapproved; code |
| assistant-agent | FOH | Gmail (`search_threads`/`get_thread`/`create_draft`/`label_*`), Calendar (`list_events`/`create_event`/`suggest_time`), Notion, `mcp__scheduled-tasks__*` | schedule | sending/deleting without approval |

**Rule:** FOH agents draft only. Nothing sends, posts, or deletes without human approval or an approved scheduled n8n workflow.
