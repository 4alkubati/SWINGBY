#!/usr/bin/env bash
# SwingBy session doctor — runs after every Claude Code session (SessionEnd hook).
# Checks the failure classes that have actually burned us; writes a plain
# what-broke/why/next-step report to ~/brain/logs/.
# Born from the 2026-07-17 outage: migration applied to prod DB while the code
# commit sat unpushed on this box -> every users() embed from bookings 400'd.

set -u
REPO="$HOME/agents/projects/swingby"
LOGDIR="$HOME/brain/logs"
LATEST="$LOGDIR/DOCTOR-LATEST.md"
DAILY="$LOGDIR/doctor-$(date +%F).log"
THROTTLE="$LOGDIR/.doctor-last-run"
API="https://swingbyy-api.onrender.com"
BIZ_EMAIL="testbusiness@swingby.dev"   # committed test account (see CLAUDE.md)
BIZ_PASS="SwingBy2024!"

mkdir -p "$LOGDIR"

# Throttle: skip if a full run happened in the last 10 minutes (login rate
# limit is 5/min/IP; rapid-fire session ends must not burn it).
if [ -f "$THROTTLE" ] && [ $(( $(date +%s) - $(stat -c %Y "$THROTTLE") )) -lt 600 ]; then
  exit 0
fi
date +%s > "$THROTTLE"

FAILS=0
REPORT=""
say() { REPORT+="$1"$'\n'; }
fail() { FAILS=$((FAILS+1)); say "- FAIL — $1"; }
pass() { say "- PASS — $1"; }

say "# SwingBy doctor — $(date '+%F %H:%M')"
say ""

# ── 1. Local repo hygiene ─────────────────────────────────────────────
cd "$REPO" 2>/dev/null || { fail "repo missing at $REPO"; }

if [ -d "$REPO/.git" ]; then
  git -C "$REPO" fetch origin main --quiet 2>/dev/null
  UNPUSHED=$(git -C "$REPO" log --oneline origin/main..HEAD 2>/dev/null | wc -l)
  if [ "$UNPUSHED" -gt 0 ]; then
    fail "$UNPUSHED commit(s) on main not pushed. Why it matters: prod DB and prod code can drift apart (this exact drift caused the Jul 17 dashboard outage). Next step: tell Claude \"push main and verify prod\"."
  else
    pass "no unpushed commits — prod code matches this box"
  fi
  DIRTY=$(git -C "$REPO" status --porcelain 2>/dev/null | wc -l)
  if [ "$DIRTY" -gt 0 ]; then
    say "- WARN — $DIRTY uncommitted file(s) in the repo. Next step: ask Claude to review and commit or discard them."
  fi
fi

# ── 2. Env files the app silently dies without ────────────────────────
if grep -qs "EXPO_PUBLIC_API_URL=" "$REPO/mobile/.env"; then
  pass "mobile/.env present with EXPO_PUBLIC_API_URL"
else
  fail "mobile/.env missing or empty. Why: the app falls back to 127.0.0.1 (the phone itself) and every screen hangs. Next step: copy mobile/.env.example to mobile/.env, then restart Expo with --clear."
fi

# ── 3. Prod backend health (Render free tier may cold-start ~60s) ─────
HEALTH=$(curl -s -m 75 -o /dev/null -w "%{http_code}" "$API/health" 2>/dev/null)
if [ "$HEALTH" = "200" ]; then
  pass "prod backend healthy ($API)"
else
  fail "prod backend health check returned '$HEALTH'. Why: app is dead for everyone. Next step: check Render dashboard for the swingby-api service; ask Claude to read the deploy logs."
fi

# ── 4. Business dashboard journey (the walkthrough path) ──────────────
if [ "$HEALTH" = "200" ]; then
  TOKEN=$(curl -s -m 40 -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$BIZ_EMAIL\",\"password\":\"$BIZ_PASS\"}" 2>/dev/null \
    | python3 -c "import sys,json;print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)
  if [ -z "$TOKEN" ]; then
    fail "business test login failed. Why: nobody can log in, or the rate limit (5/min) was hit. Next step: retry in 2 minutes; if it persists, ask Claude to check /auth/login on prod."
  else
    for EP in /bookings/ /service-posts/ /businesses/me /messages/threads; do
      CODE=$(curl -s -m 30 -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" "$API$EP" 2>/dev/null)
      if [ "$CODE" = "200" ]; then
        pass "$EP returns 200"
      else
        fail "$EP returns $CODE. Why: the business dashboard cannot load without it. Next step: ask Claude to diagnose $EP on prod (check for a DB/code drift like an ambiguous PostgREST embed)."
      fi
    done
  fi
fi

# ── Verdict + write reports ────────────────────────────────────────────
say ""
if [ "$FAILS" -eq 0 ]; then
  say "**Verdict: all clear.** App is walkthrough-ready."
else
  say "**Verdict: $FAILS problem(s) found.** Fix before inviting a tester."
fi

printf '%s\n' "$REPORT" > "$LATEST"
printf '%s\n\n' "$REPORT" >> "$DAILY"
# Copy for the morning brief — n8n only sees the repo mount, not ~/brain (gitignored)
printf '%s\n' "$REPORT" > "$REPO/AGENTS/claude/memory/DOCTOR-LATEST.md"
exit 0
