import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { getItemsByIds, getSellerItemIds } from "../../../../../lib/ml/api";
import { withUserMlAccessToken } from "../../../../../lib/ml/tokens";
import { getSessionUserIdFromRequest } from "../../../../../lib/auth/session";
import { getUserBillingEntitlement } from "../../../../../lib/billing/entitlements";

export async function GET(request: NextRequest) {
  const sessionUserId = getSessionUserIdFromRequest(request);
  if (!sessionUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: {
      id: true,
      mlUserId: true,
      accessToken: true,
      refreshToken: true,
      tokenExpiresAt: true,
    },
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const entitlement = await getUserBillingEntitlement(user.id);
  if (!entitlement.hasAccess) {
    return NextResponse.json(
      {
        ok: false,
        error: "subscription_required",
        message: "Active subscription required. Start trial in Billing to access inventory sync.",
        subscriptionStatus: entitlement.status,
      },
      { status: 402 },
    );
  }

  const statusParam = request.nextUrl.searchParams.get("status") ?? "active";

  try {
    const items = await withUserMlAccessToken(user, async (accessToken) => {
      const itemIds = await getSellerItemIds({
        accessToken,
        mlUserId: user.mlUserId,
        status: statusParam,
      });

      return getItemsByIds({ accessToken, itemIds });
    });

    return NextResponse.json(
      {
        ok: true,
        seller: user.mlUserId,
        status: statusParam,
        count: items.length,
        items,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      { ok: false, error: "ml_items_fetch_failed", message },
      { status: 502 }
    );
  }
}
