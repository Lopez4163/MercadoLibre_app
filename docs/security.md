# Security Posture and Production Checklist

Last updated: March 15, 2026

## Production Security Status
1. [x] Mercado Libre webhook fails closed in production if secret missing/malformed.
2. [x] Telegram webhook fails closed in production if secret missing.
3. [x] `POST /api/jobs/orders-cleanup` hardened (rate limit, generic errors, optional IP allow-list support).
4. [x] `GET /api/orders/recent` status filter allow-list + page-size cap.
5. [x] Anti-abuse throttling on test endpoints:
   - `POST /api/notifications/test`
   - `POST /api/telegram/test`
6. [x] Placeholder API routes removed/locked down.
7. [x] Per-user refresh rate limits:
   - `GET /api/ml/items`
   - `GET /api/orders/recent`
   - `GET /api/orders/today-summary`
   - production strict mode requires Upstash Redis.

## Reconciler Hardening
1. [x] Single-run lock (no overlap).
2. [ ] Scheduler verified end-to-end in hosted environment.
3. [x] Retry/backoff for transient ML/Telegram failures.
4. [x] Run history + retention cleanup.

## Must Verify Before Production Access
1. [ ] Hosted reconcile scheduler: every 10 min with valid `x-reconcile-secret`.
2. [ ] Staging smoke pass:
   - OAuth connect
   - Telegram connect/status/test/disconnect
   - sale alerts
   - low-stock/sold-out transitions
   - webhook dedupe

## Environment/Secret Requirements
Required:
1. `DATABASE_URL`
2. `NEXTAUTH_SECRET`
3. `NEXTAUTH_URL`
4. `ML_CLIENT_ID`
5. `ML_CLIENT_SECRET`
6. `ML_REDIRECT_URI`
7. `ML_WEBHOOK_SECRET`
8. `TELEGRAM_BOT_TOKEN`
9. `TELEGRAM_BOT_USERNAME`
10. `TELEGRAM_WEBHOOK_SECRET`
11. `RECONCILE_CRON_SECRET`
12. `STRIPE_SECRET_KEY`
13. `STRIPE_PRICE_ID`
14. `STRIPE_WEBHOOK_SECRET`
15. `UPSTASH_REDIS_REST_URL` (prod strict mode)
16. `UPSTASH_REDIS_REST_TOKEN` (prod strict mode)

Operational rule:
- If `TELEGRAM_WEBHOOK_SECRET` changes, re-run Telegram `setWebhook` immediately with the same secret.
- Use controlled ops commands instead of ad-hoc manual changes:
  - check: `npm run telegram:webhook:check -- --env-file=.env.local`
  - register/update: `npm run telegram:webhook:register -- --env-file=.env.local`
