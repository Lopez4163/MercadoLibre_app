import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/db/prisma";
import { getSessionUserIdFromRequest } from "../../../../../../lib/auth/session";
import { getStripe, getStripePriceId } from "../../../../../../lib/stripe/client";
import { getUserBillingEntitlement } from "../../../../../../lib/billing/entitlements";

function getRedirectBase(request: NextRequest) {
  const configured = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL;
  const origin = configured ?? request.nextUrl.origin;

  if (/^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return origin.replace(/^https:/i, "http:");
  }

  return origin;
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

export async function POST(request: NextRequest) {
  const userId = getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
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
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const entitlement = await getUserBillingEntitlement(user.id);
  if (entitlement.hasAccess) {
    return NextResponse.json(
      {
        ok: true,
        alreadyEntitled: true,
        status: entitlement.status,
      },
      { status: 200 },
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
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        sessionId: session.id,
        url: session.url,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("stripe checkout creation failed", error);
    return NextResponse.json({ ok: false, error: "stripe_checkout_failed" }, { status: 500 });
  }
}
