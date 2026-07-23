#!/usr/bin/env bash
# Build the mobile app for the walkthrough harness.
#
# The one thing that matters here: EXPO_PUBLIC_API_URL=/api. That points the
# app's requests at the harness's own origin, so the proxy can see every call
# and the backend's CORS allowlist never gets in the way.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
MOBILE="$REPO/mobile"
OUT="${1:-$HERE/appbuild}"

cd "$MOBILE"

if [ ! -d node_modules ]; then
  echo "error: $MOBILE/node_modules is missing. Run: cd mobile && npm install" >&2
  exit 1
fi
if [ ! -w node_modules ]; then
  cat >&2 <<'EOF'
error: mobile/node_modules is not writable by you.

  It was installed as root at some point. Expo cannot resolve its config
  plugins through it, so the build will fail. Fix it once with:

    sudo chown -R "$USER":"$USER" mobile/node_modules
    cd mobile && npm install

EOF
  exit 1
fi

echo "· building web bundle → $OUT"
# EXPO_NO_DOTENV is the point of this line. Without it Expo loads
# mobile/.env.production, which sets EXPO_PUBLIC_API_URL to the Render URL and
# quietly beats the value we set here — the app would then call the backend
# cross-origin and every request would die on CORS.
# --clear is not optional either: Metro caches by source hash, not by env, so a
# rebuild after changing the API URL silently returns the previous bundle.
EXPO_NO_DOTENV=1 EXPO_PUBLIC_API_URL=/api \
  npx expo export --platform web --clear --output-dir "$OUT"

BUNDLE_DIR="$OUT/_expo/static/js/web"
if grep -rql 'onrender\.com' "$BUNDLE_DIR" 2>/dev/null; then
  echo
  echo "warning: the bundle still contains a hardcoded backend URL." >&2
  echo "         requests will bypass the proxy and fail CORS." >&2
fi

echo
echo "done. now run:"
echo "  node tools/walkthrough/server.js --app $OUT"
