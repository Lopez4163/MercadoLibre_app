# MercadoLibs Agent Guide

## Product Mission
Build a SaaS for Mercado Libre sellers that delivers inventory-risk notifications to Telegram and provides a clean operations dashboard.

## Current Repo Assessment (March 5, 2026)
Status: **MVP+ operational**.

Core flow is implemented:
1. Mercado Libre OAuth + token persistence.
2. Automatic ML token refresh + retry on unauthorized.
3. Telegram connect/disconnect/status/test flow.
4. Dashboard inventory view (search/sort/pagination/manual refresh).
5. Notification settings persistence + UI wiring.
6. Webhook ingestion with idempotency and dedupe.
7. Order sold, low-stock, and sold-out alert dispatch logic.
8. Batched reconciler route and core reconcile engine.

## Architecture Snapshot
1. Dashboard currently reads inventory live from ML via `/api/ml/items`.
2. Local `Item` table acts as operational snapshot for alerting/reconcile.
3. ML webhook events are deduped via `MlWebhookEvent.eventKey`.
4. Telegram delivery is gated by per-user notification settings.
5. Reconciler compares ML truth to local snapshots and can trigger transitions.

## Implemented Features
1. OAuth + signed session cookie:
   - `src/app/api/ml/callback/route.ts`
   - cookie: `ml_session` (httpOnly, signed, expiring)
2. Token lifecycle:
   - `lib/ml/auth.ts`
   - `lib/ml/tokens.ts`
3. Telegram integration:
   - `src/app/api/telegram/connect/route.ts`
   - `src/app/api/telegram/webhook/route.ts`
   - `src/app/api/telegram/status/route.ts`
   - `src/app/api/telegram/disconnect/route.ts`
   - `src/app/api/telegram/test/route.ts`
4. Notification settings:
   - `src/app/api/notifications/settings/route.ts`
   - `components/dashboard/NotificationSettingsCard.tsx`
5. ML webhook processing:
   - `src/app/api/webhooks/mercadolibre/route.ts`
   - `lib/ml/webhooks.ts`
6. Alert sender/message builders:
   - `lib/notifications/sender.ts`
   - `lib/telegram/messages.ts`
7. Reconciler:
   - `lib/ml/reconcile.ts`
   - `src/app/api/jobs/reconcile/route.ts`
8. Landing/auth/connect UX:
   - `src/app/page.tsx`
   - `src/app/connect/ml/page.tsx`
   - `components/layout/Navbar.tsx`

## Current Alert Behavior
1. `orders_v2` events send order sold alerts (`notifyEverySale`).
2. Sold-out alerts fire on transition `previousStock > 0 && currentStock === 0` (`notifySoldOut`).
3. Low-stock alerts fire on crossing `previousStock > threshold && currentStock <= threshold && currentStock > 0` (`notifyLowStock`).
4. Duplicate low-stock notifications are prevented with `Item.lowStockAlertedAt`.
5. Low-stock alert state resets when stock recovers above threshold.
6. Unsupported topics (e.g., `shipments`) are logged and ignored by design.

## Data Models In Use
1. `User` (ML identity + tokens)
2. `TelegramAccount` (linked chat ID)
3. `TelegramConnectToken` (short-lived connect code)
4. `NotificationSettings` (toggles + threshold)
5. `Item` (snapshot stock, threshold, `lowStockAlertedAt`)
6. `MlWebhookEvent` (idempotency/dedupe)

## Operations To Wire In Deploy
1. Set `RECONCILE_CRON_SECRET`.
2. Optional tuning: `RECONCILE_USER_BATCH_SIZE` (default `10` users/batch).
3. Schedule every 10 minutes:
   - `POST /api/jobs/reconcile`
   - header: `x-reconcile-secret: <RECONCILE_CRON_SECRET>`

## Known Notes
1. Dashboard inventory source is still live ML API (not DB-cached UI read).
2. Local snapshot is used for alerts and reconciliation, not as current table source.
3. Turbopack `.next` cache corruption can occur in local dev after abrupt restarts; clear `.next` and restart if needed.
4. Duplicate `orders_v2` inserts are expected and handled via `eventKey` unique dedupe.

## Remaining Gaps (Post-MVP Hardening)
1. Ensure reconciler scheduler is active in hosted environment.
2. Add item-level batch controls if catalog size grows significantly.
3. Consider DB-cached inventory reads for dashboard as usage scales.
4. Optional resolver improvement for `fbm_stock_operations` item mapping.

## Reconciler Hardening Status
1. [x] Single-run lock (no overlap).
2. [ ] Scheduler verified end-to-end (runs every 10 min with secret).
3. [x] Retry/backoff for transient ML/Telegram failures.
4. [x] Run history table + retention cleanup.

## Must Fix Before Production Access (Cousin/User Beta)
1. [x] Replace raw `ml_user_id` cookie trust with signed/encrypted server session auth.
2. [x] Add OAuth `state` generation + callback verification (CSRF protection).
3. [x] Add Mercado Libre webhook authentication/verification (comparable to Telegram secret gating).
4. [ ] Verify hosted scheduler end-to-end in staging then production:
   - Every 10 minutes
   - `POST /api/jobs/reconcile`
   - header `x-reconcile-secret: <RECONCILE_CRON_SECRET>`
5. [ ] Run staging smoke validation before granting access:
   - OAuth connect
   - Telegram connect/status/test/disconnect
   - sale alerts
   - low-stock/sold-out transitions
   - webhook dedupe

## Optional Production Hardening
1. [ ] Fail closed for ML webhook auth in production:
   - If `NODE_ENV=production` and `ML_WEBHOOK_SECRET` is missing, return `500` from `/api/webhooks/mercadolibre` to prevent unauthenticated webhook processing.

## Stripe Flows
### Recommended SaaS Billing Flow
1. User logs in via Mercado Libre OAuth and reaches dashboard.
2. User starts on free tier with clear usage limits.
3. `Start Free Trial` CTA is shown in dashboard/billing.
4. On CTA click (or paid-feature gate), backend creates Stripe Checkout Session with trial.
5. User completes card entry in Stripe Checkout.
6. Stripe webhook updates local subscription state (`trialing`, `active`, `past_due`, `canceled`).
7. App access is gated from DB subscription status (webhook-driven source of truth).
8. Billing page shows plan state, renewal/trial date, and Stripe Billing Portal link.

### Landing Page `Start Free Trial` Link Flow
1. User clicks `Start Free Trial` on landing page.
2. If not authenticated, redirect to Mercado Libre OAuth login.
3. After OAuth callback success, redirect to onboarding billing step (or dashboard trial intent route).
4. Show short trial confirmation modal/page and continue button.
5. Backend creates Stripe Checkout Session and redirects user to Stripe.
6. After Checkout return + webhook confirmation, user lands in dashboard with trial active state.

### Local Stripe Listener (Dev)
1. Start app locally (`npm run dev` or `npm run dev:ngrok`).
2. Run Stripe listener to local app webhook route:
   - `stripe listen --forward-to http://localhost:3000/api/billing/webhook`
3. Copy the shown webhook signing secret (`whsec_...`) into local env:
   - `STRIPE_WEBHOOK_SECRET=<whsec_from_stripe_listen>`
4. Trigger success event for webhook testing:
   - `stripe trigger checkout.session.completed`

## Next Session TODO: Build Environment Stages
Goal: establish clear `local` / `staging` / `production` workflow before broader production testing.

1. [x] Create hosted `staging` and `production` environments (keep local for development only).
2. [x] Provision separate databases for staging and production (no shared DB across environments).
3. [x] Configure full required env var set in each environment:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - `ML_CLIENT_ID`
   - `ML_CLIENT_SECRET`
   - `ML_REDIRECT_URI`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_BOT_USERNAME`
   - `TELEGRAM_WEBHOOK_SECRET`
   - `ML_WEBHOOK_SECRET`
   - `RECONCILE_CRON_SECRET`
4. [x] Ensure staging/prod secrets are different (especially webhook + cron secrets).
5. [x] Set deployment flow:
   - Auto deploy to staging from integration branch.
   - Deploy to production only from protected branch/tag.
6. [x] Run Prisma migrations in staging and verify schema/indexes.
7. [ ] Wire webhooks to staging first:
   - Mercado Libre webhook -> staging endpoint with secret query:
     - `https://<staging-domain>/api/webhooks/mercadolibre?secret=<ML_WEBHOOK_SECRET>`
   - Telegram webhook -> staging endpoint
8. [ ] Configure staging reconcile scheduler:
   - Every 10 minutes
   - `POST /api/jobs/reconcile`
   - header `x-reconcile-secret: <RECONCILE_CRON_SECRET>`
   - Quick verification command:
     - `RECONCILE_BASE_URL=https://<staging-domain> RECONCILE_CRON_SECRET=<staging-secret> npm run reconcile:check`
9. [ ] Validate staging for at least 24h with critical flows:
   - OAuth connect
   - Telegram connect/status/test/disconnect
   - sale alerts
   - low-stock and sold-out transitions
   - duplicate webhook dedupe
   - token refresh under expiration
10. [ ] Promote same setup to production only after staging passes.

## Required Environment Variables
1. `DATABASE_URL`
2. `NEXTAUTH_SECRET`
3. `NEXTAUTH_URL`
4. `ML_CLIENT_ID`
5. `ML_CLIENT_SECRET`
6. `ML_REDIRECT_URI`
7. `TELEGRAM_BOT_TOKEN`
8. `TELEGRAM_BOT_USERNAME`
9. `TELEGRAM_WEBHOOK_SECRET`
10. `ML_WEBHOOK_SECRET`
11. `RECONCILE_CRON_SECRET`

Optional:
1. `APP_BASE_URL`
2. `RECONCILE_USER_BATCH_SIZE`
3. `MP_ACCESS_TOKEN`
4. `MP_PUBLIC_KEY`

## MVP+ Done Criteria
Consider this phase done when all are true:
1. OAuth, Telegram connect, webhook ingestion, and notifications are working on live account.
2. Low-stock and sold-out transitions are validated with real stock changes.
3. Reconciler endpoint is scheduled every 10 minutes in deployment.
4. Token refresh works under forced expiration scenarios.
