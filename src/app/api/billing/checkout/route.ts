import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { getSessionUserIdFromRequest } from "../../../../../lib/auth/session";
import { getStripe, getStripePriceId } from "../../../../../lib/stripe/client";
import { getUserBillingEntitlement } from "../../../../../lib/billing/entitlements";
import {
  buildRateLimitHeaders,
  buildRateLimitKey,
  consumeRateLimit,
  getRequestIp,
  RateLimitConfigurationError,
  RateLimitUnavailableError,
  type RateLimitDecision,
} from "../../../../../lib/utils/rate-limit";

class CheckoutConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutConfigError";
  }
}

function getRedirectBase(request: NextRequest) {
  const configured = process.env.APP_BASE_URL?.trim();
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new CheckoutConfigError("APP_BASE_URL is required in production.");
  }

  const origin = configured ?? process.env.NEXTAUTH_URL ?? request.nextUrl.origin;

  if (/^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return origin.replace(/^https:/i, "http:");
  }

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new CheckoutConfigError("Invalid checkout base URL.");
  }

  if (process.env.NODE_ENV === "production") {
    if (parsed.protocol !== "https:") {
      throw new CheckoutConfigError("APP_BASE_URL must use https in production.");
    }

    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      throw new CheckoutConfigError("APP_BASE_URL cannot be localhost in production.");
    }
  }

  return parsed.origin;
}

function getTrialDays() {
  const raw = process.env.STRIPE_TRIAL_DAYS;
  if (!raw) {
    return undefined;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

const CHECKOUT_RATE_LIMIT = {
  limit: 10,
  windowMs: 60_000,
};

export async function POST(request: NextRequest) {
  const userId = getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let rateLimitDecision: RateLimitDecision;
  try {
    rateLimitDecision = await consumeRateLimit({
      key: buildRateLimitKey("api_billing_checkout_post", userId, getRequestIp(request)),
      limit: CHECKOUT_RATE_LIMIT.limit,
      windowMs: CHECKOUT_RATE_LIMIT.windowMs,
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
        message: "Too many billing checkout requests. Please wait and try again.",
      },
      {
        status: 429,
        headers: buildRateLimitHeaders(rateLimitDecision),
      },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      stripeCustomerId: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  }

  const entitlement = await getUserBillingEntitlement(user.id);
  if (entitlement.hasAccess) {
    return NextResponse.json(
      {
        ok: true,
        alreadyEntitled: true,
        status: entitlement.status,
      },
      { status: 200, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  }

  const stripe = getStripe();
  let stripeCustomerId = user.stripeCustomerId;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id },
    });
    stripeCustomerId = customer.id;

    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId },
    });
  }

  try {
    const baseUrl = getRedirectBase(request);
    const successUrl = new URL("/billing?checkout=success", baseUrl).toString();
    const cancelUrl = new URL("/billing?checkout=cancel", baseUrl).toString();
    const trialDays = getTrialDays();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: getStripePriceId(), quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      allow_promotion_codes: true,
      metadata: { userId: user.id },
      subscription_data: {
        metadata: { userId: user.id },
        ...(trialDays ? { trial_period_days: trialDays } : {}),
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "stripe_session_missing_url" },
        { status: 500, headers: buildRateLimitHeaders(rateLimitDecision) },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        sessionId: session.id,
        url: session.url,
      },
      { status: 200, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  } catch (error) {
    if (error instanceof CheckoutConfigError) {
      console.error("stripe checkout configuration failed", error);
      return NextResponse.json(
        { ok: false, error: "invalid_checkout_base_url" },
        { status: 500, headers: buildRateLimitHeaders(rateLimitDecision) },
      );
    }

    console.error("stripe checkout creation failed", error);
    return NextResponse.json(
      { ok: false, error: "stripe_checkout_failed" },
      { status: 500, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  }
}
