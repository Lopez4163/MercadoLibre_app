# To Do List

Date reorganized for launch: 2026-04-29

## Must Do For Launch
1. [ ] Run a staging smoke test with real Stripe webhook events to validate end-to-end delivery and entitlement transitions.
   - Existing billing route tests are mocked/unit-level and do not prove provider delivery.
2. [ ] Verify production schedulers are configured with the correct cron secrets and expected cadence.
   - `/api/jobs/reconcile`
   - `/api/jobs/orders-cleanup`
   - `/api/jobs/telegram-connect-tokens-cleanup`
3. [ ] Validate webhook endpoint auth checks against a live staging/production base URL, not an offline tunnel.
   - Mercado Libre
   - Telegram
   - Stripe
4. [ ] Apply production database migrations before public traffic.
   - Includes `EmailDelivery` once lifecycle email PR is merged.
5. [ ] Configure and verify production environment variables/secrets.
   - Database, session/OAuth, Mercado Libre, Telegram, Stripe, cron, Redis, label tokens, Gmail SMTP.
6. [ ] Rotate secrets that were exposed during local terminal output before production use.
   - Neon/Postgres password or connection string.
   - Resend API key.
7. [ ] Register or confirm provider URLs in production.
   - ML OAuth redirect: `/api/ml/callback`
   - ML webhook: `/api/webhooks/mercadolibre`
   - Telegram webhook: `/api/telegram/webhook`
   - Stripe webhook: `/api/billing/webhook`
8. [ ] Confirm and standardize the product name across product copy, notifications, and billing surfaces.
   - Current app surfaces use `MercadoLibs`; prior todo referenced `NotiVenta`.
9. [ ] Review and normalize launch-facing copy across core product surfaces so the initial LATAM release reads consistently in Spanish.
10. [ ] Keep the product Spanish-first for the initial LATAM launch instead of implementing multilingual support now.
11. [ ] Fix stale Telegram bot image documentation/path before launch runbook use.
   - Current todo/runbook references `public/images/telegram/telegramLogo-botfather-512.png`; local changes indicate a rename to `public/images/telegram/telegram_logo.png`.
12. [ ] Update the README so it describes the real app, setup, env vars, migrations, and deploy workflow instead of the default Next.js starter text.

## Done For Launch Baseline
1. [x] Fix test suite reliability so `npm test` passes in CI/local without requiring an implicit runtime DB URL for pure unit suites.
2. [x] Add CI workflow(s) to enforce `npm run lint`, `npm test`, and `npm run build` on pull requests and protected branches.
3. [x] Run the pre-production validation scripts against staging before launch:
   - `npm run security:check-env`
   - `npm run security:check-webhooks`
   - `npm run security:smoke-staging`
4. [x] Add an operator-safe production webhook registration flow for Telegram so webhook URL/secret changes are applied deliberately after deploys instead of relying on manual drift checks.
5. [x] Restrict Telegram linking to private chats only so users cannot accidentally connect a group chat and send store notifications there.
6. [x] Handle permanent Telegram delivery failures more explicitly, for example blocked bot or invalid chat, instead of retrying forever against a stale saved chat ID.
7. [x] Keep label-link fallback token lifetime at 24h to support overnight sales workflows, with safeguards:
   - One-time use token invalidation after first successful access.
   - Strict ownership/account validation on token redemption.
   - Hard 24h expiry enforcement.
   - Optional operator action to revoke all pending label links.
   - Audit logging for link generation and access events.
8. [x] Add a sign-up welcome email that thanks the user for creating an account and directs them to start the free trial.
   - Completed 2026-04-29; Gmail SMTP lifecycle email sends once after first Mercado Libre signup.
9. [x] Add a trial-started email that confirms trial access and prompts the user to connect Telegram.
   - Completed 2026-04-29; sent once when Stripe subscription enters `trialing`.
10. [x] Track lifecycle email sends in the database so welcome and activation emails are not sent more than once.
   - Completed 2026-04-29; `EmailDelivery` table dedupes lifecycle sends.
11. [x] Set a production Telegram bot profile image in BotFather so notifications show a branded avatar instead of the default letter icon.
   - Completed 2026-03-24; asset was prepared at `public/images/telegram/telegramLogo-botfather-512.png` and runbook steps documented.

## Soon After Launch
1. [ ] Extend `/api/orders/[orderId]/retry-telegram` to support retrying `label_ready` failures.
   - Prior note: currently supports only `order_sold`.
2. [ ] Improve long-order caption handling beyond current truncation so large item lists can be accessed fully.
   - Example: second follow-up message for overflow items.
3. [ ] Add cleanup for expired and used `telegramConnectToken` rows so the connection-token table does not grow indefinitely.
4. [ ] Migrate from legacy Mercado Libre env names to server-only names in deployed environments.
   - `NEXT_PUBLIC_ML_CLIENT_ID`
   - `NEXT_ML_CLIENT_SECRET`
   - `NEXT_PUBLIC_ML_REDIRECT_URL`
5. [ ] Add production observability and alerting coverage with clear response ownership.
   - Runtime errors.
   - Webhook failures.
   - Scheduler failures.
   - Delivery failure spikes.
6. [ ] Force Stripe hosted billing surfaces to Spanish instead of relying on browser auto-detection.
   - Checkout should use `locale: "es-419"`.
   - Customer Portal should match when a portal session flow is added.
7. [ ] Look into adding the current stock level for an item sold in the `order_sold` Telegram message.

## Operational Maturity
1. [ ] Evaluate Resend as the first transactional provider after a sending domain is available.
2. [ ] Define database backup/restore policy and run a restore drill with documented recovery steps and RTO/RPO targets.

## Optional If Needed Later
1. [ ] Add a Telegram-connected email that confirms delivery is active and points the user to notification settings or the dashboard.
2. [ ] Add app-branded monthly billing emails for `invoice.paid` / `invoice.payment_failed`; keep Stripe receipts as the default for now.
3. [ ] Add a weekly summary email with useful account activity, order, and alert metrics for engaged users.
