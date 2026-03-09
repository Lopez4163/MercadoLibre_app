#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${RECONCILE_BASE_URL:-}" ]]; then
  echo "Missing RECONCILE_BASE_URL. Example: https://staging-yourapp.onrender.com"
  exit 1
fi

if [[ -z "${RECONCILE_CRON_SECRET:-}" ]]; then
  echo "Missing RECONCILE_CRON_SECRET"
  exit 1
fi

url="${RECONCILE_BASE_URL%/}/api/jobs/reconcile"

echo "POST ${url}"

http_code=$(curl -sS -o /tmp/reconcile_check_response.json -w "%{http_code}" \
  -X POST "$url" \
  -H "x-reconcile-secret: ${RECONCILE_CRON_SECRET}" \
  -H "content-type: application/json")

cat /tmp/reconcile_check_response.json
printf "\nHTTP %s\n" "$http_code"

case "$http_code" in
  200)
    echo "Reconcile executed successfully."
    ;;
  409)
    echo "Reconcile is already running (lock is active)."
    ;;
  403)
    echo "Forbidden. Check RECONCILE_CRON_SECRET."
    exit 1
    ;;
  *)
    echo "Unexpected status. Inspect response above."
    exit 1
    ;;
esac
