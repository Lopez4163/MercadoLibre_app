# Deploy and Staging Runbook

Last updated: October 7, 2026

This runbook covers both the legacy MercadoLibs application and the
transitional NotiVenta V2 `/v2/connect` surface. A validation step must name
which generation it is testing; success in one does not prove the other.

## NotiVenta V2 Staging

Current endpoints:

```text
Frontend: https://mercadolibreapp-staging.up.railway.app
Backend:  https://notiventabe-staging.up.railway.app
V2 page:  https://mercadolibreapp-staging.up.railway.app/v2/connect
```

Required frontend configuration for the V2 surface:

```text
APP_BASE_URL=https://mercadolibreapp-staging.up.railway.app
NEXTAUTH_URL=https://mercadolibreapp-staging.up.railway.app
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_NOTIVENTA_API_URL=https://notiventabe-staging.up.railway.app
```

`NEXT_PUBLIC_NOTIVENTA_ENABLE_TEST_TOOLS` is an optional temporary staging
diagnostic that exposes a button for copying a short-lived Clerk bearer token.
Keep it `false` unless a supervised diagnostic specifically requires it, and
never enable it in production.

The V2 backend must independently allow the exact frontend origin through both
`CLERK_AUTHORIZED_PARTIES` and `CORS_ALLOWED_ORIGINS`, and must use the same
frontend origin for `FRONTEND_BASE_URL`.

Configure the Mercado Libre application with two distinct FastAPI routes:

| Mercado Libre field | Staging URL |
| --- | --- |
| Redirect URI | `https://notiventabe-staging.up.railway.app/api/v1/mercado-libre/oauth/callback` |
| Notifications Callback URL | `https://notiventabe-staging.up.railway.app/api/v1/mercado-libre/webhooks` |

For Colombian authorization, the backend uses
`https://auth.mercadolibre.com.co/authorization`. Do not put the OAuth callback
in the notification field; notifications are `POST` requests while the OAuth
callback accepts `GET`.

V2 staging validation must prove separately:

1. Clerk sign-in and protected FastAPI reads.
2. OAuth return to `/v2/connect?mercadoLibre=connected`.
3. Device pairing/status/removal as applicable.
4. Real notification delivery to FastAPI.
5. Worker processing and exactly-one eligible `PrintJob` behavior.

### OAuth-start troubleshooting

If **Connect Mercado Libre** returns to `/v2/connect?mercadoLibre=error` or
never opens Mercado Libre, first inspect the browser Network entry for:

```http
POST /api/v1/mercado-libre/oauth/authorize
```

Record its status and safe response body. If it succeeds, inspect the returned
`authorizationUrl` and verify its encoded `redirect_uri` is the exact registered
staging callback. Do not assume a callback mismatch is the cause when the
browser never reached Mercado Libre: authentication, CORS, or backend
configuration can fail before browser navigation.

The backend `/health` response proves only FastAPI process liveness. It does not
prove database, Redis, Celery worker, or Mercado Libre health.

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
4. Configure `ORDERS_CLEANUP_CRON_SECRET`.
5. Schedule daily:
   - `POST /api/jobs/orders-cleanup`
   - header `x-orders-cleanup-secret: <ORDERS_CLEANUP_CRON_SECRET>`
6. Verification command:
   - `ORDERS_CLEANUP_BASE_URL=https://<domain> ORDERS_CLEANUP_CRON_SECRET=<secret> npm run orders:cleanup:check`
7. Configure `TELEGRAM_CONNECT_TOKENS_CLEANUP_CRON_SECRET`.
8. Schedule every 12 hours:
   - `POST /api/jobs/telegram-connect-tokens-cleanup`
   - header `x-telegram-connect-tokens-cleanup-secret: <TELEGRAM_CONNECT_TOKENS_CLEANUP_CRON_SECRET>`
9. Verification command:
   - `TELEGRAM_CONNECT_TOKENS_CLEANUP_BASE_URL=https://<domain> TELEGRAM_CONNECT_TOKENS_CLEANUP_CRON_SECRET=<secret> npm run telegram:connect-tokens:cleanup:check`

## Telegram Webhook Registration (Operator-Safe)
1. Check current Telegram webhook target before changing anything:
   - `npm run telegram:webhook:check -- --env-file=.env.local`
2. Apply/refresh webhook URL + secret token intentionally after deploy or secret rotation:
   - `npm run telegram:webhook:register -- --env-file=.env.local`
3. Optional forced re-registration even if URL already matches:
   - `npm run telegram:webhook:register -- --env-file=.env.local --force`

## Telegram Bot Profile Image (BotFather)
1. Use the prepared bot image asset:
   - `public/images/telegram/telegram_logo.png`
2. In Telegram, open `@BotFather`.
3. Run `/mybots` and select the production bot.
4. Choose `Edit Bot` -> `Edit Botpic`.
5. Upload `public/images/telegram/telegram_logo.png`.
6. Send a test message from the bot and verify the avatar is visible in chat list + message header.

## Environment Stages
1. Keep separate `local`, `staging`, and `production` environments.
2. Use separate DBs for staging vs production.
3. Keep secrets different across staging/prod (especially webhook + cron secrets).
4. Auto-deploy to staging from integration branch.
5. Deploy production only from protected branch/tag.

## Legacy Application Staging Validation (24h recommended)
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
