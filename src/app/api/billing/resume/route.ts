import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/db/prisma";
import { getSessionUserIdFromRequest } from "../../../../../../lib/auth/session";
import { getStripe } from "../../../../../../lib/stripe/client";

function toDate(epochSeconds: number | null | undefined) {
  if (!epochSeconds || epochSeconds <= 0) {
    return null;
  }

  return new Date(epochSeconds * 1000);
}

export async function POST(request: NextRequest) {
  const userId = getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const existing = await prisma.billingSubscription.findUnique({
    where: { userId },
    select: {
      stripeSubscriptionId: true,
      status: true,
      cancelAtPeriodEnd: true,
    },
  });

  if (!existing?.stripeSubscriptionId) {
    return NextResponse.json({ ok: false, error: "no_active_subscription" }, { status: 404 });
  }

  if (existing.status === "canceled") {
    return NextResponse.json({ ok: false, error: "already_canceled" }, { status: 400 });
  }

  if (!existing.cancelAtPeriodEnd) {
    return NextResponse.json(
      {
        ok: true,
        alreadyResumed: true,
        status: existing.status,
        cancelAtPeriodEnd: false,
      },
      { status: 200 },
    );
  }

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.update(existing.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    const currentPeriodEnd = toDate(subscription.items.data[0]?.current_period_end);

    await prisma.billingSubscription.updateMany({
      where: { userId },
      data: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: toDate(subscription.canceled_at),
        currentPeriodEnd,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: currentPeriodEnd?.toISOString() ?? null,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("stripe cancellation resume failed", error);
    return NextResponse.json({ ok: false, error: "stripe_resume_failed" }, { status: 500 });
  }
}
