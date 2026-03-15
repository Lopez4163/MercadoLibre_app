# Billing and Stripe Flows

Last updated: March 15, 2026

## Recommended SaaS Billing Flow
1. User logs in via Mercado Libre OAuth.
2. User starts with free tier limits.
3. `Start Free Trial` CTA shown from dashboard/billing gates.
4. Backend creates Stripe Checkout Session with trial.
5. User completes Stripe Checkout.
6. Stripe webhook updates local subscription state.
7. App gating uses local DB entitlement (`trialing`/`active`).
8. Billing page reflects plan state and period dates.

## Landing Page Trial Flow
1. User clicks `Start Free Trial` on landing page.
2. `/start-trial` routes:
   - unauthenticated -> `/login?next=/billing?intent=trial`
   - authenticated -> `/billing?intent=trial`
3. OAuth callback validates signed state and safe return path.
4. Billing page auto-starts checkout when `intent=trial` and user is not entitled.
5. Final access still waits for webhook-driven DB update.

## Local Stripe Listener (Dev)
1. Run app: `npm run dev`
2. Run listener:
   - `stripe listen --forward-to http://localhost:3000/api/billing/webhook`
3. Set local secret from listener output:
   - `STRIPE_WEBHOOK_SECRET=<whsec_...>`
4. Trigger test event:
   - `stripe trigger checkout.session.completed`

## Stripe Implementation Status
1. [x] Billing Prisma models and user linkage.
2. [x] Shared Stripe server client utility.
3. [x] `POST /api/billing/checkout`.
4. [x] `POST /api/billing/webhook` with signature verification and key events.
5. [x] Entitlement helper for access gating.
6. [x] Test/lint coverage baseline for billing steps.
7. [x] Trial CTA + billing status UI.
8. [x] Cancel/resume actions in settings.
9. [ ] Billing Portal entrypoint.
10. [ ] Expanded webhook integration tests for payload variants.
11. [ ] Staging validation of webhook delivery + entitlement transitions.
