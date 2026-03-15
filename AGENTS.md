# MercadoLibs Agent Guide

Last updated: March 15, 2026

## Product Mission
Build a SaaS for Mercado Libre sellers that delivers inventory-risk notifications to Telegram and provides a clean operations dashboard.

## Current Status
Status: **MVP+ operational** with logged-in dashboard, settings workspace, Telegram integration, Stripe billing core, order storage, and reconcile pipeline.

## Active Priorities
1. Verify hosted scheduler end-to-end in staging/production (`/api/jobs/reconcile`).
2. Run full staging smoke pass (OAuth, Telegram connect/test/disconnect, alerts, webhook dedupe, token refresh).
3. Add Stripe Billing Portal entrypoint.
4. Add webhook integration tests for Stripe payload variants.

## Non-Negotiable Guardrails
1. Security routes fail closed in production (ML/Telegram/Stripe webhook auth).
2. Billing entitlement is webhook-driven source of truth.
3. Refresh/test endpoints stay rate-limited (Redis strict mode in production).
4. Prisma schema changes must go through migrations (`migrate dev` locally, `migrate deploy` in shared envs).
5. Do not introduce UI motion patterns that conflict with the motion style map.

## Where To Find Details
1. Architecture + feature inventory: `docs/architecture.md`
2. Security posture + prod checklist: `docs/security.md`
3. Deploy and staging runbook: `docs/deploy-runbook.md`
4. Billing/Stripe flows and TODO: `docs/billing.md`
5. UI motion + interaction standards: `docs/motion-style.md`

## Quick Ops Commands
1. Env baseline check: `npm run security:check-env`
2. Webhook/provider baseline check: `npm run security:check-webhooks -- --env-file=.env.local`
3. Staging smoke baseline: `npm run security:smoke-staging -- --env-file=.env.local`
4. Reconcile scheduler check:
   - `RECONCILE_BASE_URL=https://<domain> RECONCILE_CRON_SECRET=<secret> npm run reconcile:check`
5. Orders cleanup scheduler check: `npm run orders:cleanup:check`

## Required Env Vars (Core)
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
15. `UPSTASH_REDIS_REST_URL` (prod strict limiter)
16. `UPSTASH_REDIS_REST_TOKEN` (prod strict limiter)

Optional:
1. `APP_BASE_URL`
2. `RECONCILE_USER_BATCH_SIZE`
3. `STRIPE_TRIAL_DAYS`
4. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
