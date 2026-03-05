# MercadoLibs Agent Guide

## Product Mission
Build a SaaS that sends real-time Telegram alerts to Mercado Libre sellers in Colombia when critical inventory events happen.

## Phase 1 (MVP) Scope
Only build:
1. Mercado Libre OAuth login/connection.
2. Telegram bot connection (store `chatId`).
3. Sold-out alert (`stock === 0`).
4. Low-stock alert (`stock < threshold`).
5. ML token refresh flow (access tokens expire ~6h).

Do not build yet:
1. Payments/subscriptions.
2. Multi-account support.

## Current Repo Assessment (March 5, 2026)
Status: **MVP core flow is operational for OAuth + Telegram + order-based sale alerts; low-stock/reconciler hardening still pending**.

Baseline decisions:
1. Keep Next.js `16.1.6`.
2. Keep API route paths under `src/app/api/*`.

## What Is Implemented
1. ML OAuth callback persists seller tokens:
   - `src/app/api/ml/callback/route.ts`
2. ML token refresh + retry is integrated:
   - `lib/ml/auth.ts` (`refreshAccessToken`)
   - `lib/ml/tokens.ts` (`withUserMlAccessToken`)
   - used by `/api/ml/items` and ML webhook processing
3. Telegram connect flow is complete:
   - connect link + short one-time code persistence
   - webhook `/start` linking persists `chatId`
   - status + disconnect endpoints
   - test ping endpoint
   - `src/app/api/telegram/*`
4. Dashboard inventory UI is functional with search/sort/pagination/status badges:
   - `src/app/(dashboard)/dashboard/page.tsx`
   - `components/dashboard/InventoryTable.tsx`
5. Notification settings are persisted and wired to UI:
   - `src/app/api/notifications/settings/route.ts`
   - `components/dashboard/NotificationSettingsCard.tsx`
   - Prisma `NotificationSettings` model
6. ML webhook processing is implemented with idempotency:
   - `src/app/api/webhooks/mercadolibre/route.ts`
   - `lib/ml/webhooks.ts`
   - Prisma `MlWebhookEvent` dedupe key
7. Sale notifications now use `orders_v2` path:
   - order fetch + Telegram order alert
   - dedupe by `orders_v2:<mlUserId>:<orderId>`
8. Out-of-stock transition alerts are implemented:
   - transition-based (`prevStock > 0 && currentStock === 0`)
   - can be triggered via order decrement path or item snapshot path
9. Item snapshot model and unique upsert path are in place:
   - Prisma `Item @@unique([userId, mlItemId])`

## Current Behavior Notes
1. `shipments` and unsupported topics are intentionally ignored (logged).
2. `fbm_stock_operations` events are currently recognized but logged-only when item ID is not directly extractable from resource.
3. Alert toggles currently enforced in sender:
   - `notifyEverySale` gates order sold alerts
   - `notifySoldOut` gates out-of-stock alerts
4. `notifyLowStock` and `lowStockThreshold` are persisted but low-stock dispatch logic is not fully implemented yet.

## Remaining Blockers (MVP)
1. Implement low-stock notification dispatch using persisted threshold.
2. Add reliable resolver for `fbm_stock_operations` item mapping (or keep reconciler as source of truth correction).
3. Add lightweight reconciler job (periodic drift correction between local snapshots and ML stock).
4. Optionally reduce Prisma noise in dev logs (`query` logging level / duplicate event handling ergonomics).

## Immediate Next Steps (Execution Order)
1. Implement low-stock transition checks and Telegram dispatch using `NotificationSettings.lowStockThreshold`.
2. Add periodic reconciler (small batches) to correct snapshot drift and catch missed transitions.
3. Add stock-operation resolver for `fbm_stock_operations` resources (if item mapping endpoint available in target account scope).
4. End-to-end test matrix on real events:
   - `orders_v2` sale
   - item snapshot update
   - out-of-stock transition
   - token refresh on forced expiration

## Source of Truth Folders
1. `src/app/api/ml/*` for OAuth/token lifecycle.
2. `src/app/api/telegram/*` for connect/status/disconnect/test/webhook.
3. `src/app/api/notifications/*` for user settings persistence.
4. `src/app/api/webhooks/mercadolibre/*` for ML ingestion.
5. `lib/ml/*` for ML API and webhook business logic.
6. `lib/notifications/sender.ts` for gated Telegram dispatch.
7. `prisma/schema.prisma` + `lib/db/prisma.ts` for persistence.

## Engineering Rules
1. Keep webhook handlers idempotent and safe on retries.
2. Return `200` from webhooks without leaking secrets.
3. Do not log access tokens/secrets.
4. Keep alert dispatch failure-safe (no crash if Telegram fails).
5. Keep pages thin and business logic in `lib/*` / API routes.

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

Optional:
1. `APP_BASE_URL`
2. `MP_ACCESS_TOKEN`
3. `MP_PUBLIC_KEY`

## MVP Done Criteria
MVP is done only when all are true:
1. Seller connects ML via OAuth and tokens are stored/refreshed automatically.
2. Seller links Telegram chat successfully.
3. `orders_v2` sale events send Telegram alerts with dedupe.
4. Out-of-stock transitions send Telegram alerts without duplicates.
5. Low-stock threshold alerts are active and tested.
6. Reconciler is running (or equivalent drift-correction mechanism) and validated.
