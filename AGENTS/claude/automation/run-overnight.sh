#!/usr/bin/env bash
# Overnight loop runner — drives config/LOOP.md, auto-resumes after the usage-limit reset.
set -u
cd "$(dirname "$0")/.."            # -> AGENTS/claude
LOG="automation/overnight.log"
RESET_WAIT=${RESET_WAIT:-900}      # retry every 15 min until the window resets

PROMPT='Read ORCHESTRATOR.md and run the loop per config/LOOP.md (startup order: PRODUCT-VISION role slice, config/PATH-INDEX.md, memory/STATUS.md, memory/PLAN.md, SESSION_LOG last 3, memory/HUMAN-TODO.md). Work the "Tonight" queue in memory/PLAN.md in order; if it is empty or fully done, take the next incomplete phase in PLAN.md. AUTONOMOUS + 3-bucket gating: A just-do-it / B park human-only items to memory/HUMAN-TODO.md and keep going / C hard-stop on delete-deploy-spend-send-permissions. Never git push, never deploy, never send anything public. Booking-loop changes require python tools/e2e_smoke.py green (DISPATCH_GATE Layer 6). Use the skills (two-stage-review, systematic-debugging, verification-before-completion, learning-loop). Retry cap 3. Append SESSION_LOG at each phase boundary. When the queue is fully complete write ALL-TASKS-COMPLETE to memory/STATUS.md; if blocked needing Kira write WAITING-ON-HUMAN to memory/STATUS.md + the exact ask to HUMAN-TODO.md.'

echo "[$(date)] === overnight loop started ===" | tee -a "$LOG"
while true; do
  grep -q "ALL-TASKS-COMPLETE" memory/STATUS.md 2>/dev/null && { echo "[$(date)] Plan complete." | tee -a "$LOG"; break; }
  echo "[$(date)] --- cycle ---" | tee -a "$LOG"
  OUT=$(claude -p "$PROMPT" --dangerously-skip-permissions 2>&1); echo "$OUT" | tee -a "$LOG"
  if echo "$OUT" | grep -qiE "usage limit|rate limit|limit reached|resets at|try again later|too many requests"; then
    echo "[$(date)] Limit hit — sleeping ${RESET_WAIT}s then retrying (auto-resumes after reset)." | tee -a "$LOG"; sleep "$RESET_WAIT"
  else sleep 30; fi
done
