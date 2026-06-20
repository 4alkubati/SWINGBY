#!/usr/bin/env bash
# ============================================================
# run-overnight.sh — autonomous overnight runner for the AGENTS kit
# ------------------------------------------------------------
# WHAT: loops the orchestrator. On the 5-hour usage limit it sleeps
#       and retries until the window resets, then keeps going.
# WHY:  Claude Code has no native auto-resume. State lives in memory/,
#       so every resumed pass just re-reads STATUS/PLAN and continues.
# RUN:  from AGENTS/claude/  ->  bash automation/run-overnight.sh
#       (best inside tmux/WSL so you can close the laptop lid)
# STOP: writes ALL-TASKS-COMPLETE or NEEDS-KIRA into memory/STATUS.md
# ============================================================
set -u
cd "$(dirname "$0")/.."            # -> AGENTS/claude
LOG="automation/overnight.log"
RESET_WAIT=${RESET_WAIT:-900}      # seconds to wait between limit retries (15 min)

PROMPT='Read ORCHESTRATOR.md and CONTINUE autonomously. Work through memory/PLAN.md top to bottom. For EACH task: follow DISPATCH_GATE (all 7 layers), apply the required skills (writing-plans, systematic-debugging, two-stage-review, verification-before-completion), verify before completion, then update memory/STATUS.md, append memory/SESSION_LOG.md, and post to memory/MESSAGE_BUS.md before dispatching the next. Run the learning-loop at the close of each complex task. STOP only when: (a) a blocker needs Kira — write the line NEEDS-KIRA to memory/STATUS.md and explain — or (b) the plan is fully complete — write the line ALL-TASKS-COMPLETE to memory/STATUS.md.'

echo "[$(date)] === overnight run started ===" | tee -a "$LOG"

while true; do
  if grep -q "ALL-TASKS-COMPLETE" memory/STATUS.md 2>/dev/null; then
    echo "[$(date)] Plan complete. Stopping." | tee -a "$LOG"; break
  fi
  if grep -q "NEEDS-KIRA" memory/STATUS.md 2>/dev/null; then
    echo "[$(date)] Blocked — needs Kira. Stopping." | tee -a "$LOG"; break
  fi

  echo "[$(date)] --- cycle start ---" | tee -a "$LOG"
  OUT=$(claude -p "$PROMPT" --dangerously-skip-permissions 2>&1)
  echo "$OUT" | tee -a "$LOG"

  if echo "$OUT" | grep -qiE "usage limit|rate limit|limit reached|resets at|try again later|too many requests"; then
    echo "[$(date)] Limit hit — sleeping ${RESET_WAIT}s, then retrying (auto-resumes after the window resets)." | tee -a "$LOG"
    sleep "$RESET_WAIT"
  else
    sleep 30
  fi
done

echo "[$(date)] === overnight run ended ===" | tee -a "$LOG"
