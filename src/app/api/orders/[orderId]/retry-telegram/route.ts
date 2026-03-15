import { NextRequest, NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "../../../../../../lib/auth/session";
import { getUserBillingEntitlement } from "../../../../../../lib/billing/entitlements";
import { prisma } from "../../../../../../lib/db/prisma";
import { sendOrderSoldNotification } from "../../../../../../lib/notifications/sender";
import {
  buildRateLimitHeaders,
  buildRateLimitKey,
  consumeRateLimit,
  getRequestIp,
  RateLimitConfigurationError,
  RateLimitUnavailableError,
  type RateLimitDecision,
} from "../../../../../../lib/utils/rate-limit";

const RETRY_TELEGRAM_RATE_LIMIT = {
  limit: 10,
  windowMs: 60_000,
};

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const sessionUserId = getSessionUserIdFromRequest(request);
  if (!sessionUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const entitlement = await getUserBillingEntitlement(sessionUserId);
  if (!entitlement.hasAccess) {
    return NextResponse.json(
      {
        ok: false,
        error: "subscription_required",
        message: "Active subscription required. Start trial in Billing to retry Telegram alerts.",
        subscriptionStatus: entitlement.status,
      },
      { status: 402 },
    );
  }

  let rateLimitDecision: RateLimitDecision;
  try {
    rateLimitDecision = await consumeRateLimit({
      key: buildRateLimitKey("api_orders_retry_telegram_post", sessionUserId, getRequestIp(request)),
      limit: RETRY_TELEGRAM_RATE_LIMIT.limit,
      windowMs: RETRY_TELEGRAM_RATE_LIMIT.windowMs,
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
        message: "Too many retry requests. Please wait and try again.",
      },
      {
        status: 429,
        headers: buildRateLimitHeaders(rateLimitDecision),
      },
    );
  }

  const { orderId } = await context.params;
  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      userId: sessionUserId,
    },
    select: {
      id: true,
      mlOrderId: true,
      status: true,
      totalAmount: true,
      lines: {
        select: {
          mlItemId: true,
          title: true,
          quantity: true,
        },
      },
      notifications: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          eventType: true,
          status: true,
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json(
      { ok: false, error: "order_not_found" },
      { status: 404, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  }

  const latestNotification = order.notifications[0] ?? null;
  if (!latestNotification || latestNotification.status !== "failed") {
    return NextResponse.json(
      { ok: false, error: "no_failed_notification" },
      { status: 400, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  }

  if (latestNotification.eventType !== "order_sold") {
    return NextResponse.json(
      { ok: false, error: "unsupported_retry_event" },
      { status: 400, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  }

  try {
    const result = await sendOrderSoldNotification({
      userId: sessionUserId,
      orderId: order.mlOrderId,
      status: order.status,
      totalAmount: order.totalAmount === null ? undefined : Number(order.totalAmount),
      lines: order.lines.map((line) => ({
        itemId: line.mlItemId,
        title: line.title,
        quantity: line.quantity,
      })),
    });

    await prisma.orderNotificationLog.create({
      data: {
        orderId: order.id,
        channel: "telegram",
        eventType: "order_sold",
        status: result.sent ? "sent" : "failed",
        reason: result.sent ? null : result.reason,
        payload: {
          source: "manual_retry",
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        sent: result.sent,
        reason: result.sent ? null : result.reason,
      },
      {
        status: 200,
        headers: buildRateLimitHeaders(rateLimitDecision),
      },
    );
  } catch (error) {
    console.error("order retry telegram failed", {
      orderId,
      mlOrderId: order.mlOrderId,
      error,
    });

    await prisma.orderNotificationLog.create({
      data: {
        orderId: order.id,
        channel: "telegram",
        eventType: "order_sold",
        status: "failed",
        reason: "telegram_send_failed",
        payload: {
          source: "manual_retry",
        },
      },
    });

    return NextResponse.json(
      { ok: false, error: "telegram_send_failed" },
      {
        status: 502,
        headers: buildRateLimitHeaders(rateLimitDecision),
      },
    );
  }
}
