#!/usr/bin/env bash
# One command to get the walkthrough running on this (headless) server.
#
# Builds the app if it hasn't been built, then serves the recorder on a fixed
# port bound to all interfaces — so a laptop or phone on the Tailnet can reach
# it. The camera still needs a secure context; see "Reaching it" in the README.
# The short version: SSH-tunnel it to localhost.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8080}"
APP="$HERE/appbuild"
API="${API:-https://swingbyy-api.onrender.com}"

if [ ! -f "$APP/index.html" ]; then
  echo "· no app build yet — building (first run only, ~1 min)"
  "$HERE/build-app.sh" "$APP"
fi

TSIP="$(tailscale ip -4 2>/dev/null | head -1 || true)"
# Self.DNSName specifically — a bare grep grabs the first peer instead. python3
# is already a hard dep of this tool (diagnose.py), so lean on it for a correct
# parse rather than fighting JSON in sed.
TSNAME="$(tailscale status --json 2>/dev/null | python3 -c \
  "import json,sys; print((json.load(sys.stdin).get('Self') or {}).get('DNSName','').rstrip('.'))" \
  2>/dev/null || true)"

cat <<EOF

  Serving on port $PORT (all interfaces). To use eye tracking + voice you need
  a secure context — reach it one of these ways from your laptop:

  1. SSH tunnel (works today, nothing else to set up):
       ssh -L $PORT:localhost:$PORT l3thal@${TSNAME:-<server>}
     then open  http://localhost:$PORT

  2. Just to LOOK at the app (no camera/mic):
       http://${TSIP:-<tailscale-ip>}:$PORT/app/

EOF

exec node "$HERE/server.js" --app "$APP" --api "$API" --port "$PORT"
