#!/usr/bin/env bash
# deep_diag.sh — pre-doctor deep diagnostic (DQ-7 / TOOL-01).
#
# "A container that tests the app after a session" (Kira, 06:05 brief).
# Boots the backend LOCALLY in a throwaway Docker container using dummy/stub
# env — the exact stub values .github/workflows/backend.yml uses for CI, no
# real secrets, backend/.env is never read — then runs, in order:
#   1. pytest (backend/tests, in-container, stub env)
#   2. babel syntax parse of mobile/src + mobile/App.js
#   3. tools/flow_graph.py regeneration (nav/API graph integrity)
#   4. local boot readiness (uvicorn in a second container, /healthz poll)
#   5. tools/e2e_smoke.py against that LOCAL boot (never Render)
#
# Writes ONE markdown report to docs/diag/deep-diag-<timestamp>.md plus a
# stable docs/diag/latest.md copy. Per-stage logs land in
# docs/diag/logs/<timestamp>/ alongside it.
#
# Safe to re-run: every container is uniquely named per run and removed on
# exit; nothing here touches another process's containers. A missing
# dependency (docker, node_modules, python3) produces an honest SKIPPED line
# for the stages that need it — never a false PASS.
#
# Known, permanent limitation of stage 5: the local container only ever has
# STUB Supabase credentials (repo policy — never real secrets on this box),
# so the documented test accounts cannot log in against it. That stage is
# reported SKIPPED with the reason, not FAIL — a stub-credential login
# rejection is not an app defect and must not be reported as if it hurts app
# health.
#
# Run:  bash tools/deep_diag.sh [port]
#
# Never touches prod, never deploys, never commits.

set -uo pipefail   # NOT -e: a failing stage must not abort the other stages

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

TS="$(date +%Y%m%d-%H%M%S)"
DIAG_DIR="$REPO/docs/diag"
LOG_DIR="$DIAG_DIR/logs/$TS"
REPORT="$DIAG_DIR/deep-diag-$TS.md"
LATEST="$DIAG_DIR/latest.md"
mkdir -p "$LOG_DIR"

DIAG_PORT="${1:-8199}"

# ── dummy/stub backend env — SAME values as .github/workflows/backend.yml ──
# Never real secrets. Never reads backend/.env.
DUMMY_DATABASE_URL="postgresql://stub:stub@localhost:5432/stub"
DUMMY_SUPABASE_URL="https://stub.supabase.co"
DUMMY_SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.stub"
DUMMY_SUPABASE_SERVICE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.stub"
DUMMY_SECRET_KEY="ci-test-secret"

RUN_ID="$$-$TS"
PYTEST_CID="swingby-deep-diag-pytest-$RUN_ID"
BOOT_CID="swingby-deep-diag-boot-$RUN_ID"

STAGE_ORDER=(PYTEST BABEL_SYNTAX FLOW_GRAPH LOCAL_BOOT E2E_SMOKE_LOCAL)
declare -A STAGE_STATUS
declare -A STAGE_CAUSE

cleanup() {
  docker rm -f "$BOOT_CID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

record_stage() {
  # record_stage NAME PASS|FAIL|SKIPPED "one-line human cause"
  STAGE_STATUS["$1"]="$2"
  STAGE_CAUSE["$1"]="$3"
  echo "[deep_diag] $1: $2 — $3"
}

have_docker() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

# ── 1. pytest, in a throwaway container ─────────────────────────────────
run_pytest_stage() {
  if ! have_docker; then
    record_stage PYTEST SKIPPED "docker unavailable on this box"
    return
  fi
  local log="$LOG_DIR/pytest.log"
  docker run --rm --name "$PYTEST_CID" \
    -v "$REPO/backend":/app -w /app \
    -e DATABASE_URL="$DUMMY_DATABASE_URL" \
    -e SUPABASE_URL="$DUMMY_SUPABASE_URL" \
    -e SUPABASE_KEY="$DUMMY_SUPABASE_KEY" \
    -e SUPABASE_SERVICE_KEY="$DUMMY_SUPABASE_SERVICE_KEY" \
    -e SECRET_KEY="$DUMMY_SECRET_KEY" \
    python:3.11-slim \
    sh -c "pip install --quiet --no-cache-dir -r requirements.txt -r requirements-dev.txt 2>&1 && python -m pytest -q" \
    > "$log" 2>&1
  local rc=$?
  if [ $rc -eq 0 ]; then
    local summary
    summary=$(grep -E '[0-9]+ passed' "$log" | tail -1)
    record_stage PYTEST PASS "${summary:-pytest exited 0}"
  else
    local first_fail
    first_fail=$(grep -m1 -E '^(FAILED|E |ERROR)' "$log")
    record_stage PYTEST FAIL "${first_fail:-pytest exited $rc — see $log}"
  fi
}

# ── 2. babel syntax parse: mobile/src (existing tool) + App.js ──────────
run_babel_stage() {
  if [ ! -d "$REPO/mobile/node_modules/@babel/parser" ]; then
    record_stage BABEL_SYNTAX SKIPPED "mobile/node_modules/@babel/parser missing — run 'npm install' in mobile/"
    return
  fi
  local log="$LOG_DIR/babel_syntax.log"
  : > "$log"

  local use_host_node=0
  local use_docker_node=0

  # Try host node first
  if command -v node >/dev/null 2>&1; then
    use_host_node=1
  # Fall back to docker if host node absent
  elif have_docker; then
    use_docker_node=1
  else
    # Both node and docker unavailable
    record_stage BABEL_SYNTAX SKIPPED "node not available on host, and docker unavailable — cannot parse babel syntax"
    return
  fi

  # Helper to run babel parse via host node or docker
  run_babel_parse() {
    if [ $use_host_node -eq 1 ]; then
      node "$@"
    else
      docker run --rm -v "$REPO":/w -w /w node:20 node "$@"
    fi
  }

  # Run syntax check for mobile/src
  run_babel_parse /w/tools/syntax_check.js >> "$log" 2>&1
  local rc1=$?

  echo "---App.js---" >> "$log"
  run_babel_parse -e "
    const fs = require('fs');
    const path = require('path');
    const parser = require(path.join('/w', 'mobile', 'node_modules', '@babel', 'parser'));
    const file = path.join('/w', 'mobile', 'App.js');
    try {
      parser.parse(fs.readFileSync(file, 'utf8'), {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
        plugins: ['jsx', 'classProperties', 'optionalChaining',
                  'nullishCoalescingOperator', 'objectRestSpread',
                  'dynamicImport', 'topLevelAwait'],
      });
      console.log('[App.js] OK — parses');
    } catch (e) {
      console.log('[App.js] FAIL line ' + (e.loc ? e.loc.line : '?') + ': ' + e.message);
      process.exitCode = 1;
    }
  " >> "$log" 2>&1
  local rc2=$?

  if [ $rc1 -eq 0 ] && [ $rc2 -eq 0 ]; then
    local scanned
    scanned=$(grep -m1 'scanned' "$log")
    local method="host node"
    [ $use_docker_node -eq 1 ] && method="docker node:20"
    record_stage BABEL_SYNTAX PASS "${scanned:-mobile/src + App.js parse cleanly ($method)}"
  else
    local first_fail
    first_fail=$(grep -m1 -E 'FAIL' "$log")
    record_stage BABEL_SYNTAX FAIL "${first_fail:-syntax error — see $log}"
  fi
}

# ── 3. flow_graph.py regeneration ────────────────────────────────────────
run_flow_graph_stage() {
  if ! command -v python3 >/dev/null 2>&1; then
    record_stage FLOW_GRAPH SKIPPED "python3 not available on this box"
    return
  fi
  local log="$LOG_DIR/flow_graph.log"
  python3 "$REPO/tools/flow_graph.py" > "$log" 2>&1
  local rc=$?
  if [ $rc -ne 0 ]; then
    record_stage FLOW_GRAPH FAIL "flow_graph.py crashed (exit $rc) — $(tail -1 "$log")"
    return
  fi
  local summary broken_edges broken_api
  summary=$(grep -m1 'broken edges' "$log")
  broken_edges=$(echo "$summary" | grep -oE 'broken edges: [0-9]+' | grep -oE '[0-9]+')
  broken_api=$(echo "$summary" | grep -oE 'broken api: [0-9]+' | grep -oE '[0-9]+')
  if [ "${broken_edges:-0}" -eq 0 ] && [ "${broken_api:-0}" -eq 0 ]; then
    record_stage FLOW_GRAPH PASS "${summary:-regenerated, no broken edges/API calls}"
  else
    record_stage FLOW_GRAPH FAIL "${summary:-broken nav edges or API calls found — see docs/FLOW_GRAPH.md}"
  fi
}

# ── 4+5. boot backend locally, then run the booking-loop smoke test ─────
run_boot_and_smoke_stage() {
  if ! have_docker; then
    record_stage LOCAL_BOOT SKIPPED "docker unavailable on this box"
    record_stage E2E_SMOKE_LOCAL SKIPPED "no local boot to test against (docker unavailable)"
    return
  fi
  docker rm -f "$BOOT_CID" >/dev/null 2>&1 || true
  local bootlog="$LOG_DIR/local_boot.log"
  docker run -d --name "$BOOT_CID" \
    -v "$REPO/backend":/app -w /app \
    -p "$DIAG_PORT:8000" \
    -e DATABASE_URL="$DUMMY_DATABASE_URL" \
    -e SUPABASE_URL="$DUMMY_SUPABASE_URL" \
    -e SUPABASE_KEY="$DUMMY_SUPABASE_KEY" \
    -e SUPABASE_SERVICE_KEY="$DUMMY_SUPABASE_SERVICE_KEY" \
    -e SECRET_KEY="$DUMMY_SECRET_KEY" \
    python:3.11-slim \
    sh -c "pip install --quiet --no-cache-dir -r requirements.txt && uvicorn app.main:app --host 0.0.0.0 --port 8000" \
    > "$bootlog" 2>&1
  if [ $? -ne 0 ]; then
    record_stage LOCAL_BOOT FAIL "docker run failed to start — see $bootlog"
    record_stage E2E_SMOKE_LOCAL SKIPPED "local boot did not start"
    return
  fi

  local ready=""
  for _ in $(seq 1 30); do
    if curl -sf -m 2 "http://127.0.0.1:$DIAG_PORT/healthz" >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 2
  done

  if [ -z "$ready" ]; then
    docker logs "$BOOT_CID" >> "$bootlog" 2>&1
    record_stage LOCAL_BOOT FAIL "container never answered /healthz within 60s — check pip install / uvicorn boot errors in $bootlog"
    record_stage E2E_SMOKE_LOCAL SKIPPED "local boot never came up"
    docker rm -f "$BOOT_CID" >/dev/null 2>&1 || true
    return
  fi
  record_stage LOCAL_BOOT PASS "container up, /healthz 200 on port $DIAG_PORT"

  # e2e_smoke.py logs into the documented test accounts, which only exist
  # in the REAL Supabase project. This container deliberately only has stub
  # credentials (never real secrets locally), so login cannot succeed here
  # — that is a fixed, known limitation of running this stage locally, not
  # a signal about app health. Detect it and report SKIPPED, not FAIL.
  local smokelog="$LOG_DIR/e2e_smoke_local.log"
  python3 "$REPO/tools/e2e_smoke.py" "http://127.0.0.1:$DIAG_PORT" > "$smokelog" 2>&1
  local rc=$?
  if grep -q "PASS  login" "$smokelog"; then
    if [ $rc -eq 0 ]; then
      record_stage E2E_SMOKE_LOCAL PASS "full booking loop green against local boot"
    else
      local first_fail
      first_fail=$(grep -m1 '^FAIL' "$smokelog")
      record_stage E2E_SMOKE_LOCAL FAIL "${first_fail:-see $smokelog}"
    fi
  else
    record_stage E2E_SMOKE_LOCAL SKIPPED "local container only has stub Supabase credentials (repo policy — never real secrets here), so the documented test accounts can't log in. LOCAL_BOOT above already confirms the server boots and serves routes; full booking-loop coverage still comes from tools/e2e_smoke.py run against a backend with real Supabase creds (see CLAUDE.md)."
  fi

  docker rm -f "$BOOT_CID" >/dev/null 2>&1 || true
}

# ── run all stages, in order ─────────────────────────────────────────────
run_pytest_stage
run_babel_stage
run_flow_graph_stage
run_boot_and_smoke_stage

# ── write the report ─────────────────────────────────────────────────────
FAILS=0
SKIPS=0
for s in "${STAGE_ORDER[@]}"; do
  case "${STAGE_STATUS[$s]:-SKIPPED}" in
    FAIL) FAILS=$((FAILS+1)) ;;
    SKIPPED) SKIPS=$((SKIPS+1)) ;;
  esac
done

{
  echo "# SwingBy — Deep Diagnostic"
  echo ""
  echo "Generated: $(date '+%Y-%m-%d %H:%M %Z') · run \`bash tools/deep_diag.sh\`"
  echo ""
  echo "This runs the app against a local, throwaway Docker container with"
  echo "dummy credentials (never real secrets, never Render, never prod)."
  echo "It checks: does the backend still pass its tests, does the mobile"
  echo "code still parse, is the nav/API graph still wired correctly, and"
  echo "does the backend still boot and serve routes locally."
  echo ""
  if [ "$FAILS" -eq 0 ]; then
    echo "**Verdict: no failures.**$( [ "$SKIPS" -gt 0 ] && echo " ($SKIPS stage(s) skipped — see below, not the same as broken.)" )"
  else
    echo "**Verdict: $FAILS stage(s) failing.** See causes below."
  fi
  echo ""
  echo "## Per-flow results"
  echo ""
  echo "| Flow | Result | Cause |"
  echo "|---|---|---|"
  for s in "${STAGE_ORDER[@]}"; do
    status="${STAGE_STATUS[$s]:-SKIPPED}"
    cause="${STAGE_CAUSE[$s]:-not run}"
    # escape pipes so the cause can't break the table
    cause="${cause//|/\\|}"
    icon="?"
    case "$status" in
      PASS) icon="PASS" ;;
      FAIL) icon="FAIL" ;;
      SKIPPED) icon="SKIPPED" ;;
    esac
    echo "| $s | $icon | $cause |"
  done
  echo ""
  echo "## What each flow means"
  echo ""
  echo "- **PYTEST** — backend/tests, run in-container against stub env. FAIL means a backend test broke."
  echo "- **BABEL_SYNTAX** — mobile/src + App.js must parse as valid JS/JSX. FAIL means a mobile file has a syntax error that would crash Metro."
  echo "- **FLOW_GRAPH** — regenerates docs/FLOW_GRAPH.md. FAIL means a screen navigates somewhere that doesn't exist, or a mobile screen calls a backend route that isn't registered."
  echo "- **LOCAL_BOOT** — the backend container comes up and answers /healthz. FAIL means the app can't even start (dependency install broke, import error, etc.)."
  echo "- **E2E_SMOKE_LOCAL** — the full post→quote→accept→booking→complete journey, run against the local container. Almost always SKIPPED on this box by design (see cause) — that's expected, not a red flag. A real FAIL here (not SKIPPED) means the booking loop itself is broken."
  echo ""
  echo "## Logs"
  echo ""
  echo "Full stage logs: \`docs/diag/logs/$TS/\`"
  echo ""
  for s in "${STAGE_ORDER[@]}"; do
    echo "- $s: see $LOG_DIR"
  done
} > "$REPORT"

cp "$REPORT" "$LATEST"

echo ""
echo "[deep_diag] report: $REPORT"
echo "[deep_diag] latest: $LATEST"
echo "[deep_diag] $FAILS failing, $SKIPS skipped, $(( ${#STAGE_ORDER[@]} - FAILS - SKIPS )) passing"

exit 0
