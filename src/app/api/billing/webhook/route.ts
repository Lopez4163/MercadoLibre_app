import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { getStripe, getStripeWebhookSecret } from "../../../../../lib/stripe/client";

export const runtime = "nodejs";

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
    return;
  }

  await prisma.billingSubscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: {
      userId,
      ...payload,
    },
    update: payload,
  });
}

async function syncBySubscriptionId(subscriptionId: string, fallbackUserId?: string | null) {
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice"],
  });
  await upsertSubscriptionState(subscription, fallbackUserId);
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
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
