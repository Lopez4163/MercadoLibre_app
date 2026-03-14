#!/usr/bin/env bash

set -euo pipefail

base_url="${ORDERS_CLEANUP_BASE_URL:-http://localhost:3000}"
header_name="x-orders-cleanup-secret"

if [[ -z "${ORDERS_CLEANUP_CRON_SECRET:-}" ]]; then
  echo "Missing ORDERS_CLEANUP_CRON_SECRET"
  exit 1
fi

url="${base_url%/}/api/jobs/orders-cleanup"

http_code=$(curl -sS -o /tmp/orders_cleanup_check_response.json -w "%{http_code}" \
  -X POST "$url" \
  -H "Content-Type: application/json" \
  -H "${header_name}: ${ORDERS_CLEANUP_CRON_SECRET}" \
  --data '{}')

cat /tmp/orders_cleanup_check_response.json
echo
echo "HTTP ${http_code}"

case "${http_code}" in
  200)
    echo "Orders cleanup trigger succeeded."
    ;;
  403)
    echo "Forbidden. Check ORDERS_CLEANUP_CRON_SECRET."
    exit 1
    ;;
  *)
    echo "Unexpected status code ${http_code}"
    exit 1
    ;;
esac
