import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { getSessionUserIdFromRequest } from "../../../../../lib/auth/session";
import {
  buildRateLimitHeaders,
  buildRateLimitKey,
  consumeRateLimit,
  getRequestIp,
  RateLimitConfigurationError,
  RateLimitUnavailableError,
  type RateLimitDecision,
} from "../../../../../lib/utils/rate-limit";

const TODAY_SUMMARY_RATE_LIMIT = {
  limit: 30,
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
      key: buildRateLimitKey("api_orders_today_summary_get", sessionUserId, getRequestIp(request)),
      limit: TODAY_SUMMARY_RATE_LIMIT.limit,
      windowMs: TODAY_SUMMARY_RATE_LIMIT.windowMs,
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
        message: "Too many today-summary refresh requests. Please wait and try again.",
      },
      {
        status: 429,
        headers: buildRateLimitHeaders(rateLimitDecision),
      },
    );
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const where = {
    userId: sessionUserId,
    createdAt: {
      gte: startOfDay,
      lt: endOfDay,
    },
  };

  const [ordersCount, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: {
        lines: {
          select: {
            quantity: true,
          },
        },
        notifications: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          select: {
            status: true,
          },
        },
      },
    }),
  ]);

  let unitsSold = 0;
  let alertsSent = 0;
  let alertsFailed = 0;

  for (const order of orders) {
    for (const line of order.lines) {
      unitsSold += line.quantity;
    }

    const latestNotificationStatus = order.notifications[0]?.status;
    if (latestNotificationStatus === "sent") {
      alertsSent += 1;
    } else if (latestNotificationStatus === "failed") {
      alertsFailed += 1;
    }
  }

  return NextResponse.json(
    {
      ok: true,
      summary: {
        orders: ordersCount,
        unitsSold,
        alertsSent,
        alertsFailed,
      },
    },
    {
      status: 200,
      headers: buildRateLimitHeaders(rateLimitDecision),
    },
  );
}
