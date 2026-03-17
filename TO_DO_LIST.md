# To Do List

## Telegram Messaging Prod Follow-ups
Date: 2026-03-15 12:38:11 PM EDT

1. Reduce label-link fallback token lifetime from 24h to a shorter window (for example, 15-60 minutes) to tighten exposure if document upload falls back to link mode.
2. Extend `/api/orders/[orderId]/retry-telegram` to support retrying `label_ready` failures (currently supports only `order_sold`).
3. Improve long-order caption handling beyond current truncation so large item lists can be accessed fully (for example, second follow-up message for overflow items).
4. Set a production Telegram bot profile image in BotFather so notifications show a branded avatar instead of the default letter icon.
5. Add an operator-safe production webhook registration flow for Telegram so webhook URL/secret changes are applied deliberately after deploys instead of relying on manual drift checks.
6. Restrict Telegram linking to private chats only so users cannot accidentally connect a group chat and send store notifications there.
7. Handle permanent Telegram delivery failures more explicitly (for example, blocked bot / invalid chat) instead of retrying forever against a stale saved chat ID.
8. Add cleanup for expired and used `telegramConnectToken` rows so the connection-token table does not grow indefinitely.

## Stripe Billing Follow-ups
Date: 2026-03-17 01:34:00 PM EDT

1. Caveat: billing route tests are mocked/unit-level; run a staging smoke test with real Stripe webhook events to validate end-to-end delivery and entitlement transitions.

## Email Lifecycle Follow-ups
Date: 2026-03-17 02:53:00 PM EDT

1. Add a sign-up welcome email that thanks the user for creating an account and directs them to start the free trial.
2. Add a trial-started email that confirms trial access and prompts the user to connect Telegram.
3. Add a Telegram-connected email that confirms delivery is active and points the user to notification settings or the dashboard.
4. Add a weekly summary email with useful account activity, order, and alert metrics for engaged users.
5. Track lifecycle email sends in the database so welcome and activation emails are not sent more than once.
6. Evaluate Resend as the first transactional provider; current pricing makes it viable to stay on the free tier until roughly a few hundred active users.
