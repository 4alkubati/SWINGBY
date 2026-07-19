# SwingBy — Deep Diagnostic

Generated: 2026-07-18 18:06 MDT · run `bash tools/deep_diag.sh`

This runs the app against a local, throwaway Docker container with
dummy credentials (never real secrets, never Render, never prod).
It checks: does the backend still pass its tests, does the mobile
code still parse, is the nav/API graph still wired correctly, and
does the backend still boot and serve routes locally.

**Verdict: 1 stage(s) failing.** See causes below.

## Per-flow results

| Flow | Result | Cause |
|---|---|---|
| PYTEST | PASS | 65 passed, 3 skipped, 3 warnings in 1.89s |
| BABEL_SYNTAX | PASS | [syntax_check] scanned 116 files |
| FLOW_GRAPH | PASS | [flow_graph] broken edges: 0  global orphans: 0  per-nav orphans: 0  broken api: 0 |
| LOCAL_BOOT | FAIL | container never answered /healthz within 60s — check pip install / uvicorn boot errors in /home/l3thal/agents/projects/swingby/docs/diag/logs/20260718-180308/local_boot.log |
| E2E_SMOKE_LOCAL | SKIPPED | local boot never came up |

## What each flow means

- **PYTEST** — backend/tests, run in-container against stub env. FAIL means a backend test broke.
- **BABEL_SYNTAX** — mobile/src + App.js must parse as valid JS/JSX. FAIL means a mobile file has a syntax error that would crash Metro.
- **FLOW_GRAPH** — regenerates docs/FLOW_GRAPH.md. FAIL means a screen navigates somewhere that doesn't exist, or a mobile screen calls a backend route that isn't registered.
- **LOCAL_BOOT** — the backend container comes up and answers /healthz. FAIL means the app can't even start (dependency install broke, import error, etc.).
- **E2E_SMOKE_LOCAL** — the full post→quote→accept→booking→complete journey, run against the local container. Almost always SKIPPED on this box by design (see cause) — that's expected, not a red flag. A real FAIL here (not SKIPPED) means the booking loop itself is broken.

## Logs

Full stage logs: `docs/diag/logs/20260718-180308/`

- PYTEST: see /home/l3thal/agents/projects/swingby/docs/diag/logs/20260718-180308
- BABEL_SYNTAX: see /home/l3thal/agents/projects/swingby/docs/diag/logs/20260718-180308
- FLOW_GRAPH: see /home/l3thal/agents/projects/swingby/docs/diag/logs/20260718-180308
- LOCAL_BOOT: see /home/l3thal/agents/projects/swingby/docs/diag/logs/20260718-180308
- E2E_SMOKE_LOCAL: see /home/l3thal/agents/projects/swingby/docs/diag/logs/20260718-180308
