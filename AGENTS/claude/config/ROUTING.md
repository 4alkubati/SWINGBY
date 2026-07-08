# ROUTING — Task → Agent → MCP map

> Hardcoded routing rules. Orchestrator uses this to dispatch — never guesses.
> If a task type is not listed, add it here BEFORE dispatching.
> MCP server names are session-scoped — reference tools by **capability** (e.g. "Supabase execute_sql", "Notion query", "Chrome navigate"), never a hardcoded `mcp__<id>__` prefix.

---

## Layer 1 — Task keywords → Primary agent

| Task contains keywords | Primary agent | Track | Secondary |
|---|---|---|---|
| endpoint, route, API, FastAPI, server, backend | backend-agent | BOH | qa-agent tests after build |
| component, page, UI, React, Vite, web frontend | frontend-agent | BOH | qa-agent tests after build |
| screen, Expo, React Native, app.json, eas, navigator, mobile | mobile-agent | BOH | qa-agent |
| schema, migration, table, RLS, SQL, index, database | database-agent | BOH | security-agent checks RLS on every new table |
| mockup, design token, brand, UI spec, color, typography, a11y | design-agent | BOH | frontend/mobile implements |
| audit, security, vulnerability, secrets, RLS check, CVE | security-agent | BOH | runs last in every phase |
| test, bug, QA, regression, smoke, e2e | qa-agent | BOH | runs after backend/frontend/mobile |
| social, content, post, campaign, waitlist, beta recruit, SEO, ad | marketing-agent | FOH | — |
| press, pitch, partnership, statement, reputation, journalist | pr-agent | FOH | — |
| inbox, email triage, morning brief, schedule, calendar, admin | assistant-agent | FOH | — |
| plan, refactor, architecture, design decision | orchestrator | — | Plan subagent / council |
| documentation, README, CLAUDE.md, docs | owner-of-code | — | agent owning the touched surface |

**FOH rule:** FOH agents draft only. Nothing sends, posts, or deletes without human approval or an approved scheduled n8n workflow.

---

## Layer 2 — Agent → Owned capabilities

| Agent | Primary capabilities | Skills | Forbidden |
|---|---|---|---|
| orchestrator | scheduled tasks, session mgmt, MCP registry search | consolidate-memory, schedule | direct code edits (delegate) |
| backend-agent | Supabase execute_sql / get_logs / deploy_edge_function, Cloudflare workers + KV + R2, WebFetch | — | schema-defining migrations (database-agent only) |
| frontend-agent | preview tools (Chrome navigate / page text), artifacts | docx, pdf (specs only) | API calls outside services layer; direct DB access |
| mobile-agent | WebFetch, WebSearch, Chrome preview, Notion read | — | schema, backend routes, security policy |
| database-agent | Supabase apply_migration / list_tables / list_migrations / get_advisors / list_extensions, Cloudflare D1 + Hyperdrive | — | application logic; UI; auth code |
| design-agent | artifacts, visualize, WebSearch | pptx, pdf | production code edits |
| security-agent | Supabase get_advisors / get_logs, Cloudflare (read-only), WebSearch for CVEs | security-review, review | writing app code (recommend fixes only) |
| qa-agent | Chrome (full browser), Supabase execute_sql (read-only), Cloudflare logs | review | schema edits; code edits (file bugs only) |
| marketing-agent | WebSearch, WebFetch, Chrome, Notion | docx, pdf | sending unapproved; code/infra |
| pr-agent | WebSearch, WebFetch, Chrome, Notion | docx, pdf | public statements unapproved; code |
| assistant-agent | Gmail (search/read/draft/label), Calendar (list/create/suggest), Notion, scheduled tasks | schedule | sending/deleting without approval |

Cross-cutting (any agent): Notion read/write for specs + summaries, WebSearch for current docs, MCP registry when current connectors can't do the job, docx/xlsx/pptx/pdf skills for final deliverables only — never internal scratch.

---

## Layer 4 — Fallback chain (when an MCP fails)

```
1. Retry same MCP once with 5s backoff.
2. Still failing → emit BLOCKED to bus with the exact error.
3. Orchestrator consults MCP_INVENTORY.md for fallback.
4. No fallback → escalate to user: failed tool, retries attempted, what would unblock.
```

| Primary fails | Fallback | Notes |
|---|---|---|
| Supabase down | Cloudflare D1 (read-only check), WebSearch for status page | cannot mutate schema while down |
| Cloudflare down | Notion fetch (read docs only), retry queue | notify user |
| Chrome MCP unavailable | computer-use (slower, pixel-level) | frontend preview only |
| Notion unavailable | local memory files only | disable PM sync |

---

## Layer 5 — Dispatch template (Orchestrator writes this REQUEST to the bus)

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

## Layer 6 — When to invoke Council (multi-reviewer)

| Trigger | Council members |
|---|---|
| Architecture decision affecting >2 agents | Plan + general-purpose + code-reviewer |
| Security finding CRITICAL | security-agent + Plan + general-purpose |
| Phase completion gate | qa-agent + security-agent + general-purpose |
| Conflicting agent reports | all involved agents + Plan |

Quorum: 2/3 approve = proceed. Otherwise → user.

---
*[[MAP]] · registered types: `.claude/agents/` (regenerate from [[../../BOH/_BOH|BOH]] + [[../../FOH/_FOH|FOH]] when roles change) · gate: [[DISPATCH_GATE]]*
