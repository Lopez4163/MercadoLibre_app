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
2. Dashboard/productized UI.
3. Order/message notification types beyond stock alerts.
4. Multi-account support.

## Current Repo Assessment (March 2, 2026)
Status: **MVP flow in progress, core auth path working, inventory fetch partially working**.

Baseline decisions for this branch:
1. Keep Next.js `16.1.6` as the active framework version.
2. Keep API route paths under `src/app/api/*` for callback/webhook handling.

What is already in place:
1. `src/app` App Router scaffold exists.
2. Prisma schema exists with `User`, `TelegramAccount`, and `Item`.
3. ML OAuth callback route is implemented and upserts user tokens:
   - `src/app/api/ml/callback/route.ts`
4. Logout route exists and clears session cookie:
   - `src/app/api/auth/logout/route.ts`
5. ML items route exists and attempts to fetch seller items:
   - `src/app/api/ml/items/route.ts`
6. Dashboard page fetches inventory from `/api/ml/items` and renders a table:
   - `src/app/(dashboard)/dashboard/page.tsx`
7. Test webhook route exists under:
   - `src/app/api/webhooks/mercadolibre/route.ts`
8. Prisma client helper exists at `lib/db/prisma.ts`.

Current blockers to resolve before MVP is considered "good to go":
1. Most domain files are placeholders (empty) in `lib/`, `services/`, `hooks/`, and several route files.
2. `/api/ml/items` can return `502` when Mercado Libre upstream responds `403` (token/scope/account mismatch still under validation).
3. App contains out-of-scope scaffolding (billing/dashboard) that should not drive implementation priority for MVP.

## Source of Truth for MVP Architecture
Use these folders first:
1. `src/app/api/ml/*` for ML OAuth and token lifecycle.
2. `src/app/api/webhooks/mercadolibre/*` for webhook ingestion.
3. `lib/ml/*` for ML API client and webhook business logic.
4. `lib/telegram/*` for Telegram message delivery and account linking.
5. `lib/notifications/sender.ts` for centralized alert dispatch.
6. `lib/inventory/poller.ts` + `services/inventoryPoller.ts` for periodic threshold checks.
7. `prisma/schema.prisma` + `lib/db/prisma.ts` for persistence.

## Engineering Rules
1. Keep changes MVP-only until Phase 1 is complete.
2. Favor small, testable endpoints and service functions.
3. Make webhook handlers idempotent (safe on retries).
4. Do not log secrets/tokens.
5. Every new alert path must include a failure-safe (no crash on Telegram/API failure).

## React Component Structure
Goal: **keep implementation simple now, with light scalability for later**.

1. Use proper React component structure for every page/feature.
2. Keep pages thin: page files should compose components, not hold business logic.
3. Extract reusable UI into `components/` early when duplicated.
4. Keep components focused on one responsibility and simple props.
5. Prefer clear naming (`FeatureName`, `FeatureNameCard`, `FeatureNameSection`) over generic names.
6. Avoid over-engineering abstractions in MVP; only generalize after a second real use case.

## Required Environment Variables
Use `.env`/`.env.local`:
1. `DATABASE_URL`
2. `NEXTAUTH_SECRET`
3. `NEXTAUTH_URL`
4. `ML_CLIENT_ID`
5. `ML_CLIENT_SECRET`
6. `ML_REDIRECT_URI`
7. `TELEGRAM_BOT_TOKEN`

Optional for later phases:
1. `MP_ACCESS_TOKEN`
2. `MP_PUBLIC_KEY`

## MVP Done Criteria
MVP is done only when all are true:
1. Seller connects Mercado Libre via OAuth and tokens are stored.
2. Seller links Telegram chat successfully.
3. Webhook-driven sold-out event sends Telegram alert.
4. Poller-driven low-threshold event sends Telegram alert.
5. Access token refresh works automatically.
6. Deployed Render routes match configured ML callback/webhook URLs.
