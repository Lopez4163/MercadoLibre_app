import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { getSessionUserIdFromRequest } from "../../../../../lib/auth/session";
import { getStripe } from "../../../../../lib/stripe/client";
import {
  buildRateLimitHeaders,
  buildRateLimitKey,
  consumeRateLimit,
  getRequestIp,
  RateLimitConfigurationError,
  RateLimitUnavailableError,
  type RateLimitDecision,
} from "../../../../../lib/utils/rate-limit";

const BILLING_CANCEL_RATE_LIMIT = {
  limit: 10,
  windowMs: 60_000,
};

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

  let rateLimitDecision: RateLimitDecision;
  try {
    rateLimitDecision = await consumeRateLimit({
      key: buildRateLimitKey("api_billing_cancel_post", userId, getRequestIp(request)),
      limit: BILLING_CANCEL_RATE_LIMIT.limit,
      windowMs: BILLING_CANCEL_RATE_LIMIT.windowMs,
    });
  } catch (error) {
    if (error instanceof RateLimitConfigurationError || error instanceof RateLimitUnavailableError) {
      return NextResponse.json(
        { ok: false, error: "rate_limit_unavailable", message: "Rate limiter is unavailable. Contact support." },
        { status: 500 },
      );
    }
    throw error;
  }
  if (!rateLimitDecision.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message: "Too many billing cancel requests. Please wait and try again.",
      },
      {
        status: 429,
        headers: buildRateLimitHeaders(rateLimitDecision),
      },
    );
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
    return NextResponse.json(
      { ok: false, error: "no_active_subscription" },
      { status: 404, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  }

  if (existing.status === "canceled") {
    return NextResponse.json(
      { ok: false, error: "already_canceled" },
      { status: 400, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  }

  if (existing.cancelAtPeriodEnd) {
    return NextResponse.json(
      {
        ok: true,
        alreadyScheduled: true,
        status: existing.status,
        cancelAtPeriodEnd: true,
      },
      { status: 200, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  }

  try {
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.update(existing.stripeSubscriptionId, {
      cancel_at_period_end: true,
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
      { status: 200, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  } catch (error) {
    console.error("stripe cancellation scheduling failed", error);
    return NextResponse.json(
      { ok: false, error: "stripe_cancel_failed" },
      { status: 500, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  }
}
