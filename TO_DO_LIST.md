# To Do List

## Telegram Messaging Prod Follow-ups
Date: 2026-03-15 12:38:11 PM EDT

1. Reduce label-link fallback token lifetime from 24h to a shorter window (for example, 15-60 minutes) to tighten exposure if document upload falls back to link mode.
2. Extend `/api/orders/[orderId]/retry-telegram` to support retrying `label_ready` failures (currently supports only `order_sold`).
3. Improve long-order caption handling beyond current truncation so large item lists can be accessed fully (for example, second follow-up message for overflow items).
