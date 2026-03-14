import Stripe from "stripe";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { getStripe, getStripeWebhookSecret } from "../../../../../lib/stripe/client";
import { isBillingStatusActive } from "../../../../../lib/billing/entitlements";
import { disconnectUserIntegrationsForBillingEnd } from "../../../../../lib/account/disconnect";

export const runtime = "nodejs";
const DEFAULT_STRIPE_WEBHOOK_EVENT_RETENTION_DAYS = 30;

function toPositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function toDate(epochSeconds: number | null | undefined) {
  if (!epochSeconds || epochSeconds <= 0) {
    return null;
  }
  return new Date(epochSeconds * 1000);
}

function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  if (!customer) {
    return null;
  }
  return typeof customer === "string" ? customer : customer.id;
}

async function resolveUserIdForSubscription(
  subscription: Stripe.Subscription,
  fallbackUserId?: string | null,
) {
  const metadataUserId = subscription.metadata?.userId ?? null;
  if (metadataUserId) {
    return metadataUserId;
  }

  if (fallbackUserId) {
    return fallbackUserId;
  }

  const customerId = getCustomerId(subscription.customer);
  if (customerId) {
    const userByCustomer = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (userByCustomer) {
      return userByCustomer.id;
    }
  }

  const existing = await prisma.billingSubscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { userId: true },
  });
  return existing?.userId ?? null;
}

async function upsertSubscriptionState(subscription: Stripe.Subscription, fallbackUserId?: string | null) {
  const userId = await resolveUserIdForSubscription(subscription, fallbackUserId);
  const stripeCustomerId = getCustomerId(subscription.customer);

  if (!userId || !stripeCustomerId) {
    console.warn("[Stripe webhook] skipping subscription sync: unresolved user/customer", {
      subscriptionId: subscription.id,
      userId,
      stripeCustomerId,
    });
    return;
  }

  await prisma.user.updateMany({
    where: { id: userId },
    data: { stripeCustomerId },
  });

  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const latestInvoice =
    typeof subscription.latest_invoice === "string"
      ? subscription.latest_invoice
      : subscription.latest_invoice?.id ?? null;

  const payload = {
    stripeSubscriptionId: subscription.id,
    stripeCustomerId,
    status: subscription.status,
    priceId,
    currentPeriodStart: toDate(subscription.items.data[0]?.current_period_start),
    currentPeriodEnd: toDate(subscription.items.data[0]?.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    canceledAt: toDate(subscription.canceled_at),
    trialStart: toDate(subscription.trial_start),
    trialEnd: toDate(subscription.trial_end),
    latestInvoiceId: latestInvoice,
  };

  const existingByUser = await prisma.billingSubscription.findUnique({
    where: { userId },
    select: { stripeSubscriptionId: true },
  });

  if (existingByUser) {
    await prisma.billingSubscription.update({
      where: { userId },
      data: payload,
    });
  } else {
    await prisma.billingSubscription.upsert({
      where: { stripeSubscriptionId: subscription.id },
      create: {
        userId,
        ...payload,
      },
      update: payload,
    });
  }

  if (!isBillingStatusActive(subscription.status)) {
    await disconnectUserIntegrationsForBillingEnd(userId);
  }
}

async function syncBySubscriptionId(subscriptionId: string, fallbackUserId?: string | null) {
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice"],
  });
  await upsertSubscriptionState(subscription, fallbackUserId);
}

async function claimStripeEvent(event: Stripe.Event) {
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        eventId: event.id,
        eventType: event.type,
      },
    });
    return { duplicate: false as const };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { duplicate: true as const };
    }
    throw error;
  }
}

async function cleanupOldStripeWebhookEvents() {
  const retentionDays = toPositiveInt(
    process.env.STRIPE_WEBHOOK_EVENT_RETENTION_DAYS,
    DEFAULT_STRIPE_WEBHOOK_EVENT_RETENTION_DAYS,
  );
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  await prisma.stripeWebhookEvent.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, getStripeWebhookSecret());
  } catch (error) {
    console.error("[Stripe webhook] signature verification failed", error);
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 400 });
  }

  try {
    const eventClaim = await claimStripeEvent(event);
    if (eventClaim.duplicate) {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.userId ?? null;
        const stripeCustomerId =
          typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

        if (userId && stripeCustomerId) {
          await prisma.user.updateMany({
            where: { id: userId },
            data: { stripeCustomerId },
          });
        }

        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;
        if (subscriptionId) {
          await syncBySubscriptionId(subscriptionId, userId);
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await upsertSubscriptionState(subscription);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof invoice.parent?.subscription_details?.subscription === "string"
            ? invoice.parent.subscription_details.subscription
            : invoice.parent?.subscription_details?.subscription?.id ?? null;

        if (subscriptionId) {
          await syncBySubscriptionId(subscriptionId);
        }
        break;
      }
      default: {
        break;
      }
    }
  } catch (error) {
    console.error("[Stripe webhook] processing failed", {
      eventType: event.type,
      error,
    });
    return NextResponse.json({ ok: false, error: "processing_failed" }, { status: 500 });
  } finally {
    try {
      await cleanupOldStripeWebhookEvents();
    } catch (error) {
      console.error("[Stripe webhook] retention cleanup failed", error);
    }
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
