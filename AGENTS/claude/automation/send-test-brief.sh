#!/usr/bin/env bash
# Fire the Morning Brief workflow NOW (test Telegram delivery without waiting for 06:05).
# Prereq: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID filled in .claude/secrets/n8n.env, then:
#   docker compose -f AGENTS/claude/automation/docker-compose.yml up -d --force-recreate
set -euo pipefail
cd "$(dirname "$0")/../../.."   # repo root

# n8n takes ~15s to serve REST after a container (re)create — wait for it.
for _ in $(seq 1 30); do
  curl -sf http://localhost:5678/healthz >/dev/null 2>&1 && break
  sleep 2
done
sleep 3   # healthz goes green slightly before /rest does

PASS=$(grep -oP 'Password: \K.*' credentials/api-keys/n8n.md)
JAR=$(mktemp)
trap 'rm -f "$JAR"' EXIT

curl -sf -c "$JAR" -X POST http://localhost:5678/rest/login \
  -H "Content-Type: application/json" \
  -d "{\"emailOrLdapLoginId\":\"amrbasem37@gmail.com\",\"password\":\"$PASS\"}" >/dev/null

curl -sf -b "$JAR" http://localhost:5678/rest/workflows/MorningBriefSwing \
  | jq '{workflowData: .data, startNodes: [], triggerToStartFrom: {name: "Schedule 06:05"}}' \
  | curl -sf -b "$JAR" -X POST http://localhost:5678/rest/workflows/MorningBriefSwing/run \
      -H "Content-Type: application/json" -d @-

echo
echo "Triggered — the brief should hit your Telegram within seconds."
