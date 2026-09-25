import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { getItemsByIds, getSellerItemIds } from "../../../../../lib/ml/api";
import { withUserMlAccessToken } from "../../../../../lib/ml/tokens";
import { getSessionUserIdFromRequest } from "../../../../../lib/auth/session";
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

const INVENTORY_REFRESH_RATE_LIMIT = {
  limit: 20,
  windowMs: 60_000,
};

export async function GET(request: NextRequest) {
  const sessionUserId = getSessionUserIdFromRequest(request);
  if (!sessionUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let rateLimitDecision: RateLimitDecision;
  try {
    rateLimitDecision = await consumeRateLimit({
      key: buildRateLimitKey("api_ml_items_get", sessionUserId, getRequestIp(request)),
      limit: INVENTORY_REFRESH_RATE_LIMIT.limit,
      windowMs: INVENTORY_REFRESH_RATE_LIMIT.windowMs,
    });
  } catch (error) {
    if (error instanceof RateLimitConfigurationError || error instanceof RateLimitUnavailableError) {
      return NextResponse.json(
        {
          ok: false,
          error: "rate_limit_unavailable",
          message: "Rate limiter is unavailable. Contact support.",
        },
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
        message: "Too many inventory refresh requests. Please wait and try again.",
      },
      {
        status: 429,
        headers: buildRateLimitHeaders(rateLimitDecision),
      },
    );
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
      {
        status: 200,
        headers: buildRateLimitHeaders(rateLimitDecision),
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      { ok: false, error: "ml_items_fetch_failed", message },
      { status: 502 }
    );
  }
}
