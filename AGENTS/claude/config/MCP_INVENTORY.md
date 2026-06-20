# MCP_INVENTORY — Connector / Skill / Plugin catalog

> Single source of truth for what tools the system can use.
> Orchestrator reads this before every dispatch.
> Update when new MCPs are connected.

---

## Connected MCPs (verified 2026-05-19)

### Database & Storage

| Server | Key tools | Owner agent | Use case |
|---|---|---|---|
| Supabase | `apply_migration`, `execute_sql`, `list_tables`, `list_migrations`, `get_advisors`, `list_extensions`, `deploy_edge_function`, `list_edge_functions`, `get_edge_function`, `get_logs`, `create_branch`, `merge_branch`, `generate_typescript_types`, `get_project_url`, `get_publishable_keys`, `list_organizations`, `list_projects`, `get_project`, `search_docs` | database-agent (writes) / backend-agent (reads) / security-agent (advisors) | Postgres + edge functions + auth |
| Cloudflare D1 | `d1_database_create`, `d1_database_query`, `d1_database_get`, `d1_database_delete`, `d1_databases_list` | database-agent | Edge-deployed SQLite |
| Cloudflare KV | `kv_namespace_create`, `kv_namespace_get`, `kv_namespace_update`, `kv_namespace_delete`, `kv_namespaces_list` | backend-agent | Key-value cache / session store |
| Cloudflare R2 | `r2_bucket_create`, `r2_bucket_get`, `r2_bucket_delete`, `r2_buckets_list` | backend-agent | Object storage |
| Cloudflare Hyperdrive | `hyperdrive_config_*` | database-agent | Connection pooling for external DBs |

### Compute / Edge

| Server | Key tools | Owner | Use case |
|---|---|---|---|
| Cloudflare Workers | `workers_list`, `workers_get_worker`, `workers_get_worker_code` | backend-agent | Edge functions / APIs |
| Supabase Edge Functions | `deploy_edge_function`, `list_edge_functions`, `get_edge_function` | backend-agent | Serverless endpoints |

### Browser / UI

| Server | Key tools | Owner | Use case |
|---|---|---|---|
| Claude in Chrome | `navigate`, `get_page_text`, `find`, `form_input`, `javascript_tool`, `browser_batch`, `read_console_messages`, `read_network_requests`, `file_upload`, `tabs_*` | qa-agent (testing) / frontend-agent (preview) | DOM-aware browser control |
| Computer-use | `screenshot`, `left_click`, `type`, `key`, `scroll`, `open_application`, `computer_batch`, `teach_step` | orchestrator only | Cross-app + native-app control |

### Productivity / Project Management

| Server | Key tools | Owner | Use case |
|---|---|---|---|
| Notion | `notion-search`, `notion-fetch`, `notion-create-pages`, `notion-update-page`, `notion-create-database`, `notion-create-comment`, `notion-get-comments`, `notion-query-database-view`, `notion-query-meeting-notes`, `notion-get-teams`, `notion-get-users`, `notion-move-pages`, `notion-duplicate-page` | orchestrator (planning) / all (docs) | Specs, PM, meeting notes |
| Cowork | `create_artifact`, `list_artifacts`, `update_artifact`, `present_files`, `request_cowork_directory`, `allow_cowork_file_delete`, `read_widget_context` | orchestrator (deliverables) | Persistent live views |

### Scheduling / Ops

| Server | Key tools | Owner | Use case |
|---|---|---|---|
| scheduled-tasks | `create_scheduled_task`, `list_scheduled_tasks`, `update_scheduled_task` | orchestrator | Cron equivalent — replaces Clawra's 26 cron jobs |
| session_info | `list_sessions`, `read_transcript` | orchestrator | Memory recall across sessions |

### Discovery (find more capability)

| Server | Key tools | When to use |
|---|---|---|
| mcp-registry | `search_mcp_registry`, `list_connectors`, `suggest_connectors` | When current connectors cannot do the job |
| plugins | `list_plugins`, `search_plugins`, `suggest_plugin_install` | Finding plugin bundles |
| skills | `list_skills`, `suggest_skills` | Finding more skills |

### Search

| Server | Key tools | Owner |
|---|---|---|
| WebSearch | `WebSearch` | any agent (for research) |
| web_fetch | `mcp__workspace__web_fetch` | any agent (specific URL retrieval) |

### Travel / Misc (low-priority, leave dormant)

| Server | Key tools | Status |
|---|---|---|
| feedback-to-devs / search-flight | `feedback-to-devs`, `search-flight` | DORMANT — not used by this system |

---

## Available Skills

| Skill | Use for | Owner agent |
|---|---|---|
| docx | Word doc deliverables | any agent (final outputs only) |
| xlsx | Spreadsheet deliverables | any agent |
| pptx | Slide deck deliverables | any agent |
| pdf | PDF deliverables | any agent |
| schedule | Setting up recurring tasks | orchestrator |
| consolidate-memory | Weekly memory cleanup pass | orchestrator |
| skill-creator | Extend the system with new skills | orchestrator |
| setup-cowork | Onboarding flow | orchestrator |
| review | Code/PR review pass | security-agent / qa-agent |
| security-review | Full security audit | security-agent |
| init | Initialize CLAUDE.md in a new repo | orchestrator |
| cowork-plugin-customizer, create-cowork-plugin | Plugin builders | orchestrator |

---

## Scheduled jobs (Mesh Intelligence equivalent — set up via `mcp__scheduled-tasks__create_scheduled_task`)

| Job | Cron | Owner | Action |
|---|---|---|---|
| morning_brief | `0 8 * * *` | orchestrator | Read STATUS.md + bus tail, post one-screen summary to user |
| health_check | `0 * * * *` | qa-agent | Verify last build artifacts still run; emit DONE or BLOCKED |
| memory_consolidate | `0 4 * * 0` | orchestrator | Invoke `consolidate-memory` skill on memory/ |
| security_sweep | `0 5 * * 0` | security-agent | Full audit on active project |
| bus_cleanup | `0 3 * * *` | orchestrator | Archive RESOLVED messages older than 7 days |

Set up command (Orchestrator runs at first INTAKE completion):
```
mcp__scheduled-tasks__create_scheduled_task with each cron above
```

---

## Plugin discovery — when blocked

When an agent reports BLOCKED with reason "no tool for this", Orchestrator:
1. Call `mcp__mcp-registry__search_mcp_registry` with relevant keywords
2. If match → call `mcp__mcp-registry__suggest_connectors` to surface to user
3. If no match → `mcp__plugins__search_plugins` for installable bundles
4. If still nothing → escalate to user with the exact capability gap

---

## Forbidden combinations

| Combo | Why blocked |
|---|---|
| frontend-agent + `mcp__supabase__execute_sql` | Frontend must not touch DB directly — use backend service layer |
| qa-agent + write operations on production data | QA reads only — destructive tests on isolated branches |
| security-agent + writing app code | Recommends fixes only — backend/frontend/database execute |
| any subagent + `mcp__computer-use__*` | Orchestrator-only (cross-app safety) |
