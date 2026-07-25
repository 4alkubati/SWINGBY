#!/usr/bin/env bash
# verify_stripe.sh — prove the Stripe keys in backend/.env work, and are TEST mode.
#
# Read-only. Moves no money. Refuses to run against a live key. Kira's rule:
# never call Stripe with a key we cannot prove is a test key.
#
# Usage:  bash backend/scripts/verify_stripe.sh
set -u

ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
[ -f "$ENV_FILE" ] || { echo "❌ no .env at $ENV_FILE"; exit 1; }

# Read the values without sourcing the whole file (avoids the leading-space line).
SK=$(grep -E '^STRIPE_SECRET_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2-)
WH=$(grep -E '^STRIPE_WEBHOOK_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2-)

echo "== SwingBy Stripe key check =="

# --- secret key ---
if [ -z "$SK" ]; then
  echo "❌ STRIPE_SECRET_KEY is EMPTY — paste your sk_test_... key into backend/.env line 7"
  exit 1
fi

case "$SK" in
  sk_test_*|rk_test_*)
    echo "🔑 secret key: starts with ${SK:0:8}… — looks like TEST mode. Proceeding."
    ;;
  sk_live_*|rk_live_*)
    echo "🛑 secret key starts with ${SK:0:8}… — that is a LIVE key. Refusing to touch it."
    echo "   Put a TEST key (sk_test_...) here. Live keys move real money."
    exit 2
    ;;
  *)
    echo "⚠️  secret key does not look like a Stripe secret key (expected sk_test_...). Got: ${SK:0:8}…"
    exit 2
    ;;
esac

# --- read-only live call: who does this key belong to, and is it really test mode? ---
resp=$(curl -s -u "$SK:" https://api.stripe.com/v1/account)
if echo "$resp" | grep -q '"error"'; then
  echo "❌ Stripe rejected the key. Response:"
  echo "$resp" | head -5
  echo "   → The key is wrong, revoked, or belongs to a deleted sandbox. Grab a fresh one."
  exit 3
fi

# charges_enabled / details_submitted tell us it's a real account; the key prefix
# already told us test vs live. Pull the account id + country as proof of reach.
acct=$(echo "$resp" | grep -oE '"id": *"acct_[^"]+"' | head -1 | cut -d'"' -f4)
country=$(echo "$resp" | grep -oE '"country": *"[^"]+"' | head -1 | cut -d'"' -f4)
echo "✅ key is VALID and reaches Stripe. account=${acct:-?}  country=${country:-?}  mode=TEST"

# --- balance, read-only, confirms the API surface we actually use is reachable ---
bal=$(curl -s -u "$SK:" https://api.stripe.com/v1/balance)
if echo "$bal" | grep -q '"available"'; then
  echo "✅ /v1/balance reachable — the payments API is usable with this key."
else
  echo "⚠️  /v1/balance did not return as expected:"; echo "$bal" | head -3
fi

# --- webhook secret (format only; can't verify without a real event) ---
if [ -z "$WH" ]; then
  echo "⚠️  STRIPE_WEBHOOK_SECRET is EMPTY — captures work, but incoming webhook events"
  echo "   (payment succeeded, etc.) won't be signature-verified until you paste whsec_..."
else
  case "$WH" in
    whsec_*) echo "🔒 webhook secret present (whsec_…) — format OK." ;;
    *) echo "⚠️  STRIPE_WEBHOOK_SECRET does not start with whsec_ — check it." ;;
  esac
fi

echo "== done =="
