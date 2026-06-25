#!/usr/bin/env bash
# Overnight loop runner — drives config/LOOP.md, auto-resumes after the usage-limit reset.
set -u
cd "$(dirname "$0")/.."            # -> AGENTS/claude
LOG="automation/overnight.log"
RESET_WAIT=${RESET_WAIT:-900}      # retry every 15 min until the window resets

PROMPT='Read ORCHESTRATOR.md and run the loop per config/LOOP.md. FIRST read PRODUCT-VISION.md (your role slice) + config/PATH-INDEX.md so you never grep for paths. Continue (or draft) the phased plan in memory/PLAN.md. Build toward beta in order: kill mock data (Home/Dashboard/Chat real APIs) -> transactions sandbox -> Live Job Status (booking_events + arrive/start/complete + push + timeline UI) -> before/after photos -> end-to-end test. Run AUTONOMOUS + 3-bucket gating: just-do-it / park human-only items to memory/HUMAN-TODO.md and keep going / hard-stop on delete-deploy-spend-send. Use the skills (writing-plans, two-stage-review, ask-the-board, internal-focus-group, systematic-debugging, verification-before-completion, learning-loop). Retry cap 3. Append SESSION_LOG at each phase. When the plan is fully complete write ALL-TASKS-COMPLETE to memory/STATUS.md; if blocked needing Kira write NEEDS-KIRA to memory/STATUS.md + HUMAN-TODO.md.'

echo "[$(date)] === overnight loop started ===" | tee -a "$LOG"
while true; do
  grep -q "ALL-TASKS-COMPLETE" memory/STATUS.md 2>/dev/null && { echo "[$(date)] Plan complete." | tee -a "$LOG"; break; }
  echo "[$(date)] --- cycle ---" | tee -a "$LOG"
  OUT=$(claude -p "$PROMPT" --dangerously-skip-permissions 2>&1); echo "$OUT" | tee -a "$LOG"
  if echo "$OUT" | grep -qiE "usage limit|rate limit|limit reached|resets at|try again later|too many requests"; then
    echo "[$(date)] Limit hit — sleeping ${RESET_WAIT}s then retrying (auto-resumes after reset)." | tee -a "$LOG"; sleep "$RESET_WAIT"
  else sleep 30; fi
done
