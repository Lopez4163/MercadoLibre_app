# To Do List

Date reorganized by priority: 2026-03-20 11:25:00 PM EDT

## Level 1 (Critical Before Production)
1. Fix test suite reliability so `npm test` passes in CI/local without requiring an implicit runtime DB URL for pure unit suites.
2. Add CI workflow(s) to enforce `npm run lint`, `npm test`, and `npm run build` on pull requests and protected branches.
3. Caveat: billing route tests are mocked/unit-level; run a staging smoke test with real Stripe webhook events to validate end-to-end delivery and entitlement transitions.
4. Run the pre-production validation scripts against staging before launch: `npm run security:check-env`, `npm run security:check-webhooks`, and `npm run security:smoke-staging`.
5. Verify production schedulers are actually configured for `/api/jobs/reconcile` and `/api/jobs/orders-cleanup` with the correct cron secrets and expected cadence.
6. Validate webhook endpoint auth checks against a live staging/production base URL (not an offline tunnel) and confirm expected status codes for ML, Telegram, and Stripe probes.
7. Add an operator-safe production webhook registration flow for Telegram so webhook URL/secret changes are applied deliberately after deploys instead of relying on manual drift checks.
8. Restrict Telegram linking to private chats only so users cannot accidentally connect a group chat and send store notifications there.
9. Handle permanent Telegram delivery failures more explicitly (for example, blocked bot / invalid chat) instead of retrying forever against a stale saved chat ID.
10. Keep label-link fallback token lifetime at 24h to support overnight sales workflows (morning batch printing), but add safeguards:
    - One-time use token invalidation after first successful access.
    - Strict ownership/account validation on token redemption.
    - Hard 24h expiry enforcement.
    - Optional operator action to revoke all pending label links.
    - Audit logging for link generation and access events.

## Level 2 (Important Soon After Production)
1. Extend `/api/orders/[orderId]/retry-telegram` to support retrying `label_ready` failures (currently supports only `order_sold`).
2. Improve long-order caption handling beyond current truncation so large item lists can be accessed fully (for example, second follow-up message for overflow items).
3. Add cleanup for expired and used `telegramConnectToken` rows so the connection-token table does not grow indefinitely.
4. Add a sign-up welcome email that thanks the user for creating an account and directs them to start the free trial.
5. Add a trial-started email that confirms trial access and prompts the user to connect Telegram.
6. Add a Telegram-connected email that confirms delivery is active and points the user to notification settings or the dashboard.
7. Track lifecycle email sends in the database so welcome and activation emails are not sent more than once.
8. Migrate from legacy Mercado Libre env names (`NEXT_PUBLIC_ML_CLIENT_ID`, `NEXT_ML_CLIENT_SECRET`, `NEXT_PUBLIC_ML_REDIRECT_URL`) to server-only names in deployed environments.
9. Add production observability and alerting coverage (runtime errors, webhook failures, scheduler failures, delivery failure spikes) with clear response ownership.
10. Keep the product Spanish-first for the initial LATAM launch instead of implementing multilingual support now.
11. Review and normalize launch-facing copy across the core product surfaces so the initial LATAM release reads consistently in Spanish.
12. Confirm and standardize `NotiVenta` as the app name across product copy, notifications, and billing surfaces.

## Level 3 (Operational Maturity / Growth)
1. Set a production Telegram bot profile image in BotFather so notifications show a branded avatar instead of the default letter icon.
2. Look into adding the current stock level for an item sold in the `order_sold` Telegram message.
3. Add a weekly summary email with useful account activity, order, and alert metrics for engaged users.
4. Evaluate Resend as the first transactional provider; current pricing makes it viable to stay on the free tier until roughly a few hundred active users.
5. Define database backup/restore policy and run a restore drill with documented recovery steps and RTO/RPO targets.
