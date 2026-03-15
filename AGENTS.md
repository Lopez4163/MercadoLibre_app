# MercadoLibs Agent Guide

## Product Mission
Build a SaaS for Mercado Libre sellers that delivers inventory-risk notifications to Telegram and provides a clean operations dashboard.

## Current Repo Assessment (March 15, 2026)
Status: **MVP+ operational with upgraded logged-in dashboard flow**.

Core flow is implemented:
1. Mercado Libre OAuth + token persistence.
2. Automatic ML token refresh + retry on unauthorized.
3. Telegram connect/disconnect/status/test flow.
4. Dashboard inventory view (search/sort/pagination/manual refresh).
5. Notification settings persistence + UI wiring.
6. Webhook ingestion with idempotency and dedupe.
7. Order sold, low-stock, and sold-out alert dispatch logic.
8. Batched reconciler route and core reconcile engine.
9. Telegram shipping-label flow with signed download route and shipment-ready follow-up alerts.
10. Logged-in dashboard shell with top navigation, profile page, settings workspace, and stats tab.

## Architecture Snapshot
1. Dashboard currently reads inventory live from ML via `/api/ml/items`.
2. Local `Item` table acts as operational snapshot for alerting/reconcile.
3. ML webhook events are deduped via `MlWebhookEvent.eventKey`.
4. Telegram delivery is gated by per-user notification settings.
5. Reconciler compares ML truth to local snapshots and can trigger transitions.
6. Logged-in UX is split between:
   - `/dashboard` for operational overview
   - `/settings/*` for configuration
   - `/profile` for account summary

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
9. Stripe billing core:
   - `src/app/api/billing/checkout/route.ts`
   - `src/app/api/billing/webhook/route.ts`
   - `src/app/api/billing/status/route.ts`
   - `src/app/api/billing/cancel/route.ts`
   - `src/app/api/billing/resume/route.ts`
   - `lib/stripe/client.ts`
   - `lib/billing/entitlements.ts`
10. Trial entry and post-login routing:
   - `src/app/start-trial/page.tsx`
   - `lib/auth/next-path.ts`
   - `src/app/api/ml/oauth/start/route.ts` (`next` support)
   - `src/app/api/ml/callback/route.ts` (signed return path handling)
11. Order sale type + shipping label flow:
   - `lib/ml/api.ts`
   - `lib/ml/webhooks.ts`
   - `lib/notifications/sender.ts`
   - `lib/telegram/bot.ts`
   - `lib/telegram/messages.ts`
   - `lib/labels/token.ts`
   - `src/app/api/orders/[orderId]/label/route.ts`
   - `lib/app/base-url.ts`
12. Logged-in dashboard shell + settings workspace:
   - `src/app/(dashboard)/layout.tsx`
   - `src/app/(dashboard)/dashboard/page.tsx`
   - `components/dashboard/DashboardWorkspace.tsx`
   - `src/app/(dashboard)/profile/page.tsx`
   - `src/app/(dashboard)/settings/layout.tsx`
   - `components/layout/SettingsSidebarNav.tsx`
   - `src/app/(dashboard)/settings/notifications/page.tsx`
   - `src/app/(dashboard)/settings/telegram/page.tsx`
   - `src/app/(dashboard)/settings/billing/page.tsx`
   - `components/dashboard/NotificationRulesCard.tsx`
   - `components/dashboard/TelegramSettingsCard.tsx`
   - `components/billing/ManageSubscriptionActions.tsx`
13. Dashboard activity summary optimization:
   - `src/app/api/orders/today-summary/route.ts`
   - `components/dashboard/DashboardWorkspace.tsx` (`loadTodayActivity` now uses summary endpoint)
14. Billing gate UX hardening + Telegram connect reliability:
   - `components/dashboard/DashboardWorkspace.tsx` (trial/telegram CTA states, no paid-user trial CTA flicker)
   - `components/dashboard/NotificationRulesCard.tsx` (initial server entitlement passed to avoid trial overlay flash)
   - `components/dashboard/TelegramSettingsCard.tsx` (initial server entitlement, connect polling, manual refresh)
   - `src/app/(dashboard)/settings/notifications/page.tsx` (server entitlement passthrough)
   - `src/app/(dashboard)/settings/telegram/page.tsx` (server entitlement passthrough)

## Current Alert Behavior
1. `orders_v2` events send order sold alerts (`notifyEverySale`).
2. Order sold alerts remain the primary sale notification.
3. Order sold alerts try to include an inline `Download Label` button when a shipment already exists at order-processing time.
4. `shipments` events are now supported for label-ready follow-ups:
   - no Telegram message is sent until ML label fetch succeeds
   - once the label is printable, a second Telegram `Label ready` message is sent with `Download Label`
   - label-ready follow-up can include sale type derived from shipment logistic type:
     - `self_service` -> `Flex`
     - `fulfillment` -> `Full`
     - else -> `Other`
   - duplicate shipment retries are deduped by `shipment_label:<mlUserId>:<shipmentId>`
5. Sold-out alerts fire on transition `previousStock > 0 && currentStock === 0` (`notifySoldOut`).
   - `orders_v2` flow now prefers live ML stock during transition checks to reduce false sold-out alerts from stale snapshots.
6. Low-stock alerts fire on crossing `previousStock > threshold && currentStock <= threshold && currentStock > 0` (`notifyLowStock`).
7. Duplicate low-stock notifications are prevented with `Item.lowStockAlertedAt`.
8. Low-stock alert state resets when stock recovers above threshold.
9. Unsupported topics outside order/item/shipment flows are logged and ignored by design.

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
4. Run pre-deploy secret baseline check:
   - `npm run security:check-env`
   - blocks deploy if required ML/Telegram/Stripe/Redis/session secrets are missing or weak.
5. Run webhook provider/config baseline check:
   - `npm run security:check-webhooks -- --env-file=.env.local`
   - verifies Telegram provider URL, Stripe endpoint presence/events, and webhook secret enforcement on ML/Telegram/Stripe routes.
6. Run staging smoke baseline:
   - `npm run security:smoke-staging -- --env-file=.env.local`
   - runs env + webhook + scheduler checks and core auth-gate route probes (OAuth start/callback redirects, billing/alerts/telegram protected routes).
7. Telegram webhook secret sync rule:
   - if `TELEGRAM_WEBHOOK_SECRET` changes, re-run Telegram `setWebhook` with the same secret immediately, or Telegram connect will fail with webhook `403`.

## Known Notes
1. Dashboard inventory source is still live ML API (not DB-cached UI read).
2. Local snapshot is used for alerts and reconciliation, not as current table source.
3. Logged-in dashboard now uses a top-nav shell:
   - `Dashboard`
   - `Settings`
   - `Profile`
   - `Logout`
4. Settings is now a dedicated sidebar workspace with:
   - `Notifications`
   - `Telegram`
   - `Billing`
5. Dashboard tabs currently include:
   - `Overview`
   - `Inventory`
   - `Orders`
   - `Stats`
   - `Notifications`
6. Stats tab uses ML item fields only (`sold_quantity`, `available_quantity`, `price`, `status`) and currently includes:
   - Top Seller
   - Total Units Sold
   - Fast Movers At Risk
   - Dormant Stock
   - Sell-Through Leaders
   - Catalog Value
   - Risk Rate
7. Turbopack `.next` cache corruption can occur in local dev after abrupt restarts; clear `.next` and restart if needed.
8. Duplicate `orders_v2` inserts are expected and handled via `eventKey` unique dedupe.
9. Duplicate shipment-label follow-up attempts are expected and handled via `shipment_label:<mlUserId>:<shipmentId>` dedupe.
10. `Label not ready` from the signed label route means shipment exists but ML has not exposed a printable label at that moment, or that shipment mode does not provide one.
11. `npm run dev:ngrok` interleaves Next and ngrok logs heavily; prefer separate terminals for webhook debugging.
12. If Telegram connect stays `Not connected` after `/start`, check provider webhook health first:
   - run `npm run security:check-webhooks -- --env-file=.env.local`
   - a Telegram webhook `403 Forbidden` usually means secret mismatch between app env and provider webhook registration.

## Remaining Gaps (Post-MVP Hardening)
1. Ensure reconciler scheduler is active in hosted environment.
2. Add item-level batch controls if catalog size grows significantly.
3. Consider DB-cached inventory reads for dashboard as usage scales.
4. Optional resolver improvement for `fbm_stock_operations` item mapping.
5. Shipping-label flow is implemented for v1, but could be hardened further:
   - Distinguish `not ready yet` vs `no printable label for this shipment mode` in UI/logging
   - Optionally store Telegram `message_id` and edit/reply to the original order message instead of sending a second label-ready message
   - Add focused integration coverage for shipment-ready timing and label dedupe
6. Dashboard/orders UI status:
   - `Orders` tab is now a real order feed backed by local order storage (`/api/orders/recent`)
   - dashboard stats are still ML-item-derived only, not time-windowed analytics
7. Consider extracting reusable stat/list card primitives if the dashboard keeps growing.

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

## Production Security TODO (Current)
1. [x] Fail closed for Mercado Libre webhook auth in production:
   - If `NODE_ENV=production` and `ML_WEBHOOK_SECRET` is missing/malformed, reject requests from `/api/webhooks/mercadolibre` (do not allow unauthenticated processing).
2. [x] Fail closed for Telegram webhook auth in production:
   - If `NODE_ENV=production` and `TELEGRAM_WEBHOOK_SECRET` is missing, reject `/api/telegram/webhook` requests.
3. [x] Harden `POST /api/jobs/orders-cleanup`:
   - Add very-low rate limiting.
   - Optionally enforce scheduler IP allow-list in production.
   - Keep generic error responses only.
4. [x] Harden `GET /api/orders/recent` filter validation:
   - Validate `status` against an explicit allow-list (`all`, `paid`, `confirmed`, `cancelled`).
   - Keep `pageSize` cap (`<= 100`) enforced.
5. [x] Add anti-abuse throttling for test notification endpoints:
   - `POST /api/notifications/test`
   - `POST /api/telegram/test`
6. [x] Remove or lock down placeholder API routes before production:
   - `/api/auth/[...nextauth]`
   - `/api/inventory`
   - `/api/inventory/threshold`
   - `/api/billing/subscribe`
7. [x] Add per-user refresh rate limits:
   - `GET /api/ml/items`
   - `GET /api/orders/recent`
   - `GET /api/orders/today-summary`
   - production strict mode now requires Redis (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) for distributed enforcement.

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
2. `/start-trial` routes user:
   - unauthenticated -> `/login?next=/billing?intent=trial`
   - authenticated -> `/billing?intent=trial`
3. Login page passes safe `next` to `/api/ml/oauth/start`.
4. OAuth callback validates signed state and redirects to signed return path.
5. Billing page auto-starts checkout when `intent=trial` and user is not already entitled.
6. After Checkout return, app still waits for webhook-driven DB state for final entitlement.

### Local Stripe Listener (Dev)
1. Start app locally (`npm run dev` or `npm run dev:ngrok`).
2. Run Stripe listener to local app webhook route:
   - `stripe listen --forward-to http://localhost:3000/api/billing/webhook`
3. Copy the shown webhook signing secret (`whsec_...`) into local env:
   - `STRIPE_WEBHOOK_SECRET=<whsec_from_stripe_listen>`
4. Trigger success event for webhook testing:
   - `stripe trigger checkout.session.completed`

### Stripe TODO (Implementation Plan)
1. [x] Add billing Prisma models linked to `User` (`stripeCustomerId`, subscription state table).
2. [x] Add Stripe server client utility (`STRIPE_SECRET_KEY` validation + shared initialization).
3. [x] Implement `POST /api/billing/checkout`:
   - Auth required (`ml_session`)
   - Create/reuse Stripe customer
   - Create Stripe Checkout subscription session with `STRIPE_PRICE_ID` and trial
4. [x] Implement `POST /api/billing/webhook`:
   - Verify signature with `STRIPE_WEBHOOK_SECRET`
   - Process key events:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
   - Upsert local subscription state from webhook payload
5. [x] Add entitlement helper for app gating (`trialing`/`active` access).
6. [x] Add tests for each Stripe step and run:
   - `npm run test`
   - `npm run lint`
7. [x] Add minimal UI wiring:
   - `Start Free Trial` button -> checkout endpoint
   - Billing status view from DB subscription state
8. [x] Add billing actions in settings:
   - Cancel subscription (confirmation modal) -> period-end cancellation
   - Resume subscription before period end
   - Hide trial CTA while subscription is entitled (`trialing`/`active`)
9. [ ] Add Billing Portal entrypoint (after core checkout/webhook is stable).
10. [ ] Add webhook event integration tests for Stripe payload variants.
11. [ ] Validate staging webhook delivery + entitlement transitions end-to-end.

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
12. `STRIPE_SECRET_KEY`
13. `STRIPE_PRICE_ID`
14. `STRIPE_WEBHOOK_SECRET`

Optional:
1. `APP_BASE_URL`
2. `RECONCILE_USER_BATCH_SIZE`
3. `MP_ACCESS_TOKEN`
4. `MP_PUBLIC_KEY`
5. `STRIPE_TRIAL_DAYS`
6. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Prisma Law (Team Workflow)
Use this as the required database workflow for all future schema changes.

1. Development schema updates (normal path):
   - Edit `prisma/schema.prisma`.
   - Create migration locally from an interactive terminal:
     - `npx prisma migrate dev --name <change_name>`
   - Commit both:
     - `prisma/schema.prisma`
     - `prisma/migrations/<timestamp>_<change_name>/migration.sql`
   - Regenerate client when needed:
     - `npx prisma generate`

2. Shared environments (staging/production):
   - Never use `migrate dev`.
   - Apply committed migrations only:
     - `npx prisma migrate deploy`

3. Drift handling:
   - If dev data can be discarded:
     - `npx prisma migrate reset`
     - then continue with normal `migrate dev` flow.
   - If data must be preserved:
     - Do not reset.
     - Baseline/resolve migration history first, then continue with normal migration flow.

4. Guardrails:
   - Do not use `prisma db push` on shared/staging/production databases.
   - Avoid manual DB schema changes outside Prisma migrations.
   - `prisma/migrations` in git is the source of truth.

5. This repo specific:
   - Create migrations locally in an interactive terminal.
   - In CI/deployment and non-interactive environments, use only:
     - `npx prisma migrate deploy`

## MVP+ Done Criteria
Consider this phase done when all are true:
1. OAuth, Telegram connect, webhook ingestion, and notifications are working on live account.
2. Low-stock and sold-out transitions are validated with real stock changes.
3. Reconciler endpoint is scheduled every 10 minutes in deployment.
4. Token refresh works under forced expiration scenarios.
