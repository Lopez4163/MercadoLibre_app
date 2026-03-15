# Deploy and Staging Runbook

Last updated: March 15, 2026

## Baseline Pre-Deploy Checks
1. `npm run security:check-env`
2. `npm run security:check-webhooks -- --env-file=.env.local`
3. `npm run security:smoke-staging -- --env-file=.env.local`

## Scheduler Wiring
1. Configure `RECONCILE_CRON_SECRET`.
2. Schedule every 10 minutes:
   - `POST /api/jobs/reconcile`
   - header `x-reconcile-secret: <RECONCILE_CRON_SECRET>`
3. Verification command:
   - `RECONCILE_BASE_URL=https://<domain> RECONCILE_CRON_SECRET=<secret> npm run reconcile:check`

## Environment Stages
1. Keep separate `local`, `staging`, and `production` environments.
2. Use separate DBs for staging vs production.
3. Keep secrets different across staging/prod (especially webhook + cron secrets).
4. Auto-deploy to staging from integration branch.
5. Deploy production only from protected branch/tag.

## Staging Validation (24h recommended)
1. OAuth connect flow.
2. Telegram connect/status/test/disconnect.
3. Sale alert dispatch.
4. Low-stock and sold-out transitions.
5. Webhook dedupe behavior.
6. Token refresh under forced expiry.

## Prisma Law
1. Local development schema changes:
   - edit `prisma/schema.prisma`
   - run `npx prisma migrate dev --name <change_name>`
   - commit schema + migration files
2. Shared envs (staging/prod):
   - run only `npx prisma migrate deploy`
3. Guardrails:
   - never use `prisma db push` on shared envs
   - avoid manual schema edits outside migrations

## MVP+ Done Criteria
1. OAuth, Telegram connect, webhook ingestion, and notifications validated on live account.
2. Low-stock/sold-out transitions validated with real stock movement.
3. Reconcile scheduler runs every 10 minutes in deployment.
4. Token refresh works under forced expiration.
