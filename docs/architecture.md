# Architecture and Feature Inventory

Last updated: March 15, 2026

## Snapshot
1. Dashboard reads inventory live from ML via `/api/ml/items`.
2. Local `Item` table is the operational snapshot for alerting/reconcile.
3. ML webhook events are deduped via `MlWebhookEvent.eventKey`.
4. Telegram delivery is gated by per-user notification settings.
5. Reconciler compares ML truth to local snapshots and triggers transitions.
6. Logged-in UX split:
   - `/dashboard` operations
   - `/settings/*` configuration
   - `/profile` account summary

## Implemented Core
1. OAuth + signed session cookie (`ml_session`).
2. ML token refresh + retry on unauthorized.
3. Telegram connect/webhook/status/disconnect/test.
4. Notification settings API + UI wiring.
5. ML webhook ingestion with idempotency.
6. Alert sender/message builders.
7. Reconcile engine + batched route.
8. Stripe checkout/webhook/status/cancel/resume core.
9. Shipping-label signed route + shipment-ready follow-up alerts.
10. Logged-in dashboard shell + settings workspace.
11. Orders tab backed by local order storage (`/api/orders/recent`).

## Current Alert Behavior
1. `orders_v2` sends order sold alerts (`notifyEverySale`).
2. Sold-out on transition `previousStock > 0 && currentStock === 0`.
3. Low-stock on threshold crossing with dedupe (`lowStockAlertedAt`).
4. `shipments` supports label-ready follow-up message with dedupe key:
   - `shipment_label:<mlUserId>:<shipmentId>`
5. Unsupported topics are logged and ignored.

## Data Models In Use
1. `User`
2. `TelegramAccount`
3. `TelegramConnectToken`
4. `NotificationSettings`
5. `Item`
6. `MlWebhookEvent`
7. `Order` / `OrderLine` / `OrderNotificationLog`
8. `BillingSubscription` / `StripeWebhookEvent`
9. `ReconcileJobLock` / `ReconcileRun`

## Known Notes
1. Dashboard table source is still live ML API (not DB-cached reads).
2. Local snapshots are authoritative for alerts/reconciliation logic.
3. Stats are currently ML-item-derived (not time-windowed analytics).
4. If Telegram connect remains `Not connected` after `/start`, verify provider webhook config and secret sync.

## Remaining Gaps (Post-MVP Hardening)
1. Ensure hosted scheduler is active and verified.
2. Add item-level batch controls if catalog size grows.
3. Consider DB-cached inventory reads as usage scales.
4. Optional resolver improvement for `fbm_stock_operations` item mapping.
5. Harden shipping-label UX distinctions (`not ready` vs `no printable label`).
6. Consider reusable card primitives if dashboard complexity grows further.
