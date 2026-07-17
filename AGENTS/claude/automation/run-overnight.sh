#!/usr/bin/env bash
# Overnight loop runner — drives config/LOOP.md, auto-resumes after the usage-limit reset.
# Guards (added 2026-07-17 after the 397885 livelock — spawns hard-stopping on a
# perceived collision were respawned every 30s all night, burning Opus):
#   1. flock lockfile — only one runner can ever be alive.
#   2. WAITING-ON-HUMAN in STATUS.md ends the loop (everything left is Kira-gated).
#   3. Fast-fail backoff — 3 consecutive cycles that die in <120s stop the loop
#      instead of respawning forever.
set -u
cd "$(dirname "$0")/.."            # -> AGENTS/claude
LOG="automation/overnight.log"
LOCK="automation/.overnight.lock"
RESET_WAIT=${RESET_WAIT:-900}      # retry every 15 min until the window resets
MODEL=${OVERNIGHT_MODEL:-claude-opus-4-8}  # orchestrator brain — Opus plans/delegates, subagents execute
MIN_CYCLE_SECS=120                 # a real cycle plans+dispatches; under this = hard-stop
MAX_FAST_FAILS=3

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "[$(date)] Another overnight runner holds $LOCK — refusing to double-run." | tee -a "$LOG"
  exit 1
fi

PROMPT='Read ORCHESTRATOR.md and run the loop per config/LOOP.md (startup order: KIRA.md, PRODUCT-VISION role slice, config/PATH-INDEX.md, memory/STATUS.md, memory/PLAN.md, SESSION_LOG last 3, memory/HUMAN-TODO.md). You are the orchestrator BRAIN: plan and review only — dispatch implementation to the registered subagents (backend-agent, mobile-agent, qa-agent, marketing-agent) per the Route column in PLAN.md; check each result against its DONE-RULE before marking done. Work the "Tonight" queue in memory/PLAN.md in order; if it is empty or fully done, take the next incomplete phase in PLAN.md. AUTONOMOUS + 3-bucket gating: A just-do-it / B park human-only items to memory/HUMAN-TODO.md and keep going / C hard-stop on delete-deploy-spend-send-permissions. Never git push, never deploy, never send anything public. Booking-loop changes require python tools/e2e_smoke.py green (DISPATCH_GATE Layer 6). Use the skills (two-stage-review, systematic-debugging, verification-before-completion, learning-loop). Retry cap 3. Append SESSION_LOG at each phase boundary. When the queue is fully complete write ALL-TASKS-COMPLETE to memory/STATUS.md; if blocked needing Kira write WAITING-ON-HUMAN to memory/STATUS.md + the exact ask to HUMAN-TODO.md.'

echo "[$(date)] === overnight loop started ===" | tee -a "$LOG"
FAST_FAILS=0
while true; do
  grep -q "ALL-TASKS-COMPLETE" memory/STATUS.md 2>/dev/null && { echo "[$(date)] Plan complete." | tee -a "$LOG"; break; }
  grep -q "WAITING-ON-HUMAN" memory/STATUS.md 2>/dev/null && { echo "[$(date)] Waiting on Kira — everything left is in HUMAN-TODO. Loop ends." | tee -a "$LOG"; break; }
  echo "[$(date)] --- cycle ---" | tee -a "$LOG"
  CYCLE_START=$(date +%s)
  OUT=$(claude -p "$PROMPT" --model "$MODEL" --dangerously-skip-permissions 2>&1); echo "$OUT" | tee -a "$LOG"
  CYCLE_SECS=$(( $(date +%s) - CYCLE_START ))
  if echo "$OUT" | grep -qiE "usage limit|rate limit|limit reached|resets at|try again later|too many requests"; then
    echo "[$(date)] Limit hit — sleeping ${RESET_WAIT}s then retrying (auto-resumes after reset)." | tee -a "$LOG"; sleep "$RESET_WAIT"
    FAST_FAILS=0
  elif [ "$CYCLE_SECS" -lt "$MIN_CYCLE_SECS" ]; then
    FAST_FAILS=$((FAST_FAILS+1))
    echo "[$(date)] Cycle died in ${CYCLE_SECS}s (fast-fail $FAST_FAILS/$MAX_FAST_FAILS)." | tee -a "$LOG"
    if [ "$FAST_FAILS" -ge "$MAX_FAST_FAILS" ]; then
      echo "[$(date)] $MAX_FAST_FAILS consecutive hard-stops — something is wrong (collision? bad prompt? auth?). Stopping instead of burning tokens; see the output above." | tee -a "$LOG"
      break
    fi
    sleep 300
  else
    FAST_FAILS=0
    sleep 30
  fi
done
