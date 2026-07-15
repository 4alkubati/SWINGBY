# FLOW_GRAPH — code-flow scanner for SwingBy

Back to [[_AUTOMATION]].

## What it is

A regex-based scanner that reads every navigator, screen, backend router, and mobile API call, then emits a Mermaid graph + report of broken navigation, orphan screens, and 404-ing API calls.

## Files

- **Script:** `tools/flow_graph.py` (Python 3.14)
- **Human report:** `docs/FLOW_GRAPH.md` — Mermaid diagram (orphans are red), broken nav edges, per-nav orphans, broken API calls, inventory counts
- **Machine data:** `docs/flow-graph.json` — same data, structured. Read this in-session instead of scanning 20 screen files.
- **Visual page:** `tools/flow_artifact.py` — renders the JSON as a self-contained HTML page ("SwingBy Flow Atlas": per-navigator mermaid tabs, health pills, filterable edge index). Published as a Claude Artifact at https://claude.ai/code/artifact/9fdb1a32-1cb8-43bd-903f-ee5fcdba87ce — after regenerating, ask Claude to republish to that same URL.

## When to use it

**FIRST, before opening any nav file** when the user reports:
- "Button doesn't work / doesn't go anywhere"
- "I click X and nothing happens"
- "This screen isn't reachable"
- "The mobile API is returning 404"
- "A feature is unreachable in the app"

The graph gives you the answer in one read (~15k tokens) instead of scanning 20+ screen files.

## How to run

From project root:

```
"C:/Python314/python.exe" tools/flow_graph.py
```

Output — three counts:
```
[flow_graph] broken edges: N  global orphans: N  per-nav orphans: N  broken api: N
```

Regenerate any time. **Do this after any nav change** (adding a screen, wiring a button, changing an API path).

## What the counts mean

- **broken edges** — `navigation.navigate('X')` where X isn't registered. Fix by registering the screen or fixing the string.
- **global orphans** — Screens with no incoming navigation from anywhere. Dead code.
- **per-nav orphans** — Screens registered in a navigator but unreachable from within that user role's flow. Business user can't reach it even though client can.
- **broken api** — Mobile calls `api.get('/foo')` but backend has no matching route. Path params normalized.

## Interpretation notes

- **Tab.Screen entries and `*Tabs` wrappers are auto-reachable** — the scanner excludes them (they're reached by tab press or as stack roots).
- **Screens flagged as global orphan are the primary concern** — they're dead code or bugs.
- **Per-nav orphans matter when only one role can't reach something** — e.g. Business owners couldn't reach Settings even though Client could, until 2026-07-01.
- **Transitive dead-ends** — if `Settings` is orphan, then `PrivacyPolicy` (only reached via Settings) is also effectively dead. Fix the root orphan first; the tool only surfaces direct orphans.

## Adding to workflow

The generated report file is the single source of truth for "what connects to what". Reference it before touching nav code.
