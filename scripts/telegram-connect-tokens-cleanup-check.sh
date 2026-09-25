#!/usr/bin/env bash

set -euo pipefail

base_url="${TELEGRAM_CONNECT_TOKENS_CLEANUP_BASE_URL:-${ORDERS_CLEANUP_BASE_URL:-http://localhost:3000}}"
header_name="x-telegram-connect-tokens-cleanup-secret"

if [[ -z "${TELEGRAM_CONNECT_TOKENS_CLEANUP_CRON_SECRET:-}" ]]; then
  echo "Missing TELEGRAM_CONNECT_TOKENS_CLEANUP_CRON_SECRET"
  exit 1
fi

url="${base_url%/}/api/jobs/telegram-connect-tokens-cleanup"

http_code=$(curl -sS -o /tmp/telegram_connect_tokens_cleanup_check_response.json -w "%{http_code}" \
  -X POST "$url" \
  -H "Content-Type: application/json" \
  -H "${header_name}: ${TELEGRAM_CONNECT_TOKENS_CLEANUP_CRON_SECRET}" \
  --data '{}')

cat /tmp/telegram_connect_tokens_cleanup_check_response.json
echo
echo "HTTP ${http_code}"

case "${http_code}" in
  200)
    echo "Telegram connect token cleanup trigger succeeded."
    ;;
  403)
    echo "Forbidden. Check TELEGRAM_CONNECT_TOKENS_CLEANUP_CRON_SECRET."
    exit 1
    ;;
  *)
    echo "Unexpected status code ${http_code}"
    exit 1
    ;;
esac
