#!/usr/bin/env bash
# commit_series.sh — atomic, deploy-safe commits from the 2026-07-01 audit.
#
# Run from repo root in Git Bash:
#   bash tools/commit_series.sh
#
# Each commit is shippable on its own. Code and its imports are staged together
# so no commit can break `main.py` on Render. `credentials/` is never staged.
#
# The final `git push origin main` is COMMENTED OUT — push manually after review.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "--- pre-flight ---"
git status --short | head -10
echo ""

echo "--- 1/7 · D2.2 invoices (backend + mobile) ---"
git add backend/app/api/invoices.py \
        backend/requirements.txt \
        mobile/src/screens/shared/InvoiceScreen.js \
        mobile/src/navigation/BusinessNavigator.js \
        mobile/src/navigation/ClientNavigator.js \
        mobile/src/services/api.js
git commit -m "feat(D2.2): invoices - backend PDF receipts + InvoiceScreen"

echo "--- 2/7 · D2.3 off-platform pay ---"
git add backend/app/api/payments_offplatform.py \
        mobile/src/screens/client/BookingDetailsScreen.js \
        mobile/src/screens/business/JobManagementScreen.js
git commit -m "feat(D2.3): off-platform payment marking"

echo "--- 3/7 · D2.4 subscriptions + accept gate ---"
git add backend/app/api/subscriptions.py \
        backend/app/api/payments_stripe.py \
        backend/app/api/interests.py \
        backend/app/main.py \
        backend/app/api/employees.py \
        mobile/src/screens/business/BusinessProfileScreen.js \
        mobile/src/screens/business/DashboardScreen.js
git commit -m "feat(D2.4): business subscription - plan tiers, 402 accept gate, Stripe webhook"

echo "--- 4/7 · F1 payments/mine + F2 disputes router (audit fixes) ---"
git add backend/app/api/payments.py \
        backend/app/api/disputes.py \
        mobile/src/screens/business/EarningsScreen.js \
        docs/disputes_table.sql
git commit -m "feat(audit): F1 GET /payments/mine + F2 disputes router - closes both broken API calls"

echo "--- 5/7 · Mobile fixes + Map removal + Maps key placeholder ---"
git add mobile/src/screens/ mobile/src/components/ mobile/app.json
# Remove deleted MapScreen files (already deleted from disk)
git rm -f mobile/src/screens/shared/MapScreen.js mobile/src/screens/shared/MapScreen.web.js 2>/dev/null || true
git commit -m "fix(mobile): screen polish, dead-end wiring, remove MapScreen (dupe of NearbyMap), Maps key placeholder"

echo "--- 6/7 · Roadmap + docs + tools ---"
git add Roadmap/ \
        docs/ \
        CLAUDE.md \
        .gitignore \
        .vscode/ \
        credentials/README.md \
        tools/
git commit -m "docs: July dailies, flow graph tool, finish-line plan, hygiene sweep, audit deliverables"

echo "--- 7/7 · project-docs → docs/archive (rename) ---"
# The mv already happened on disk; git needs to record it.
git add -A docs/archive/
git rm -rf project-docs/ 2>/dev/null || true
git commit -m "chore: archive legacy project-docs into docs/archive" || echo "  (nothing to commit here — already staged)"

echo ""
echo "--- STAGED. Verify + push manually: ---"
echo "  git log --oneline origin/main..HEAD"
echo "  git push origin main"
