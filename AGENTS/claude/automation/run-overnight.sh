#!/usr/bin/env bash
# Overnight loop runner — drives config/LOOP.md, auto-resumes after the usage-limit reset.
# Guards (added 2026-07-17 after the 397885 livelock — spawns hard-stopping on a
# perceived collision were respawned every 30s all night, burning Opus):
#   1. flock lockfile — only one runner can ever be alive.
#   2. WAITING-ON-HUMAN pauses the loop in a zero-token poll (2026-07-17 v2 — it
#      used to end the loop; now the moment Kira checks off / edits the blocking
#      item in HUMAN-TODO.md, or clears the marker, or touches automation/RESUME,
#      the loop wakes and continues autonomously. Gives up after PAUSE_MAX).
#   3. Fast-fail backoff — 3 consecutive cycles that die in <120s stop the loop
#      instead of respawning forever. (Cycles that end still WAITING-ON-HUMAN are
#      exempt — a wake-check that re-blocks is supposed to be short.)
set -u
cd "$(dirname "$0")/.."            # -> AGENTS/claude
LOG="automation/overnight.log"
LOCK="automation/.overnight.lock"
RESUME="automation/RESUME"
RESET_WAIT=${RESET_WAIT:-900}      # retry every 15 min until the window resets
MODEL=${OVERNIGHT_MODEL:-claude-opus-4-8}  # orchestrator brain — Opus plans/delegates, subagents execute
MIN_CYCLE_SECS=120                 # a real cycle plans+dispatches; under this = hard-stop
MAX_FAST_FAILS=3
PAUSE_POLL=${PAUSE_POLL:-300}      # while WAITING-ON-HUMAN: re-check for the unblock every 5 min (grep only, zero tokens)
PAUSE_MAX=${PAUSE_MAX:-172800}     # stop waiting after 48h — at that point the run is genuinely over

exec 9>"$LOCK"
if ! flock -n 9; then
  echo "[$(date)] Another overnight runner holds $LOCK — refusing to double-run." | tee -a "$LOG"
  exit 1
fi

PROMPT='Read ORCHESTRATOR.md and run the loop per config/LOOP.md (startup order: KIRA.md, PRODUCT-VISION role slice, config/PATH-INDEX.md, memory/STATUS.md, memory/PLAN.md, SESSION_LOG last 3, memory/HUMAN-TODO.md). You are the orchestrator BRAIN: plan and review only — dispatch implementation to the registered subagents (backend-agent, mobile-agent, qa-agent, marketing-agent) per the Route column in PLAN.md; check each result against its DONE-RULE before marking done. UNBLOCK CHECK FIRST: if memory/STATUS.md contains WAITING-ON-HUMAN, re-read memory/HUMAN-TODO.md — if the blocking asks are now done (checked off `- [x]`, answered inline, or struck through), remove the WAITING-ON-HUMAN marker from STATUS.md, append a one-line "unblocked by Kira" note to SESSION_LOG, and resume the queue from the next command; if they are NOT done, leave the marker in place and end the session immediately with a one-line SESSION_LOG note (the runner will keep watching for the unblock — do not burn tokens re-planning). Work the "Tonight" queue in memory/PLAN.md in order; if it is empty or fully done, take the next incomplete phase in PLAN.md. AUTONOMOUS + 3-bucket gating: A just-do-it / B park human-only items to memory/HUMAN-TODO.md and keep going / C hard-stop on delete-deploy-spend-send-permissions. Never git push, never deploy, never send anything public. Booking-loop changes require python tools/e2e_smoke.py green (DISPATCH_GATE Layer 6). Use the skills (two-stage-review, systematic-debugging, verification-before-completion, learning-loop). Retry cap 3. Append SESSION_LOG at each phase boundary. When the queue is fully complete write ALL-TASKS-COMPLETE to memory/STATUS.md; if blocked needing Kira write WAITING-ON-HUMAN to memory/STATUS.md + the exact ask to HUMAN-TODO.md.'

todo_sig() {
  # Fingerprint of HUMAN-TODO.md — changes when Kira checks a box or edits an answer.
  md5sum memory/HUMAN-TODO.md 2>/dev/null | cut -d' ' -f1
}

wait_for_human() {
  # Zero-token pause: poll files until the unblock signal, PAUSE_MAX, or give up.
  local start base
  start=$(date +%s)
  base=$(todo_sig)
  echo "[$(date)] WAITING-ON-HUMAN — pausing (poll ${PAUSE_POLL}s, max ${PAUSE_MAX}s). Unblock by checking the ⛔ item in memory/HUMAN-TODO.md, clearing the marker in STATUS.md, or: touch AGENTS/claude/automation/RESUME" | tee -a "$LOG"
  while true; do
    sleep "$PAUSE_POLL"
    if ! grep -q "WAITING-ON-HUMAN" memory/STATUS.md 2>/dev/null; then
      echo "[$(date)] Marker cleared in STATUS.md — resuming." | tee -a "$LOG"; return 0
    fi
    if [ -f "$RESUME" ]; then
      rm -f "$RESUME"
      echo "[$(date)] RESUME file touched — resuming." | tee -a "$LOG"; return 0
    fi
    if [ "$(todo_sig)" != "$base" ]; then
      echo "[$(date)] HUMAN-TODO.md changed — waking the orchestrator to re-check the blocking items." | tee -a "$LOG"; return 0
    fi
    if [ $(( $(date +%s) - start )) -ge "$PAUSE_MAX" ]; then
      echo "[$(date)] Waited ${PAUSE_MAX}s with no unblock — ending the loop. Restart with: bash AGENTS/claude/automation/run-overnight.sh" | tee -a "$LOG"; return 1
    fi
  done
}

echo "[$(date)] === overnight loop started ===" | tee -a "$LOG"
rm -f "$RESUME"   # a stale RESUME must not skip a future pause
FAST_FAILS=0
while true; do
  grep -q "ALL-TASKS-COMPLETE" memory/STATUS.md 2>/dev/null && { echo "[$(date)] Plan complete." | tee -a "$LOG"; break; }
  if grep -q "WAITING-ON-HUMAN" memory/STATUS.md 2>/dev/null; then
    wait_for_human || break
  fi
  echo "[$(date)] --- cycle ---" | tee -a "$LOG"
  CYCLE_START=$(date +%s)
  OUT=$(claude -p "$PROMPT" --model "$MODEL" --dangerously-skip-permissions 2>&1); echo "$OUT" | tee -a "$LOG"
  CYCLE_SECS=$(( $(date +%s) - CYCLE_START ))
  if echo "$OUT" | grep -qiE "usage limit|rate limit|limit reached|resets at|try again later|too many requests"; then
    echo "[$(date)] Limit hit — sleeping ${RESET_WAIT}s then retrying (auto-resumes after reset)." | tee -a "$LOG"; sleep "$RESET_WAIT"
    FAST_FAILS=0
  elif grep -q "WAITING-ON-HUMAN" memory/STATUS.md 2>/dev/null; then
    # Wake-check found the block still standing (or a cycle newly blocked) —
    # short by design, so it never counts toward fast-fail. Top of loop re-pauses.
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
