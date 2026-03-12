import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { getSessionUserIdFromRequest } from "../../../../../lib/auth/session";
import { getUserBillingEntitlement } from "../../../../../lib/billing/entitlements";

export async function GET(request: NextRequest) {
  const userId = getSessionUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const [subscription, entitlement] = await Promise.all([
    prisma.billingSubscription.findUnique({
      where: { userId },
      select: {
        status: true,
        priceId: true,
        trialEnd: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    }),
    getUserBillingEntitlement(userId),
  ]);

  return NextResponse.json(
    {
      ok: true,
      hasAccess: entitlement.hasAccess,
      status: subscription?.status ?? null,
      priceId: subscription?.priceId ?? null,
      trialEnd: subscription?.trialEnd?.toISOString() ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    },
    { status: 200 },
  );
}
