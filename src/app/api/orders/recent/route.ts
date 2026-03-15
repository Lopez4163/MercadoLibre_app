import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
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

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MS_IN_30_DAYS = 30 * 24 * 60 * 60 * 1000;
const ORDER_STATUS_ALLOW_LIST = ["paid", "confirmed", "cancelled"] as const;
const ORDERS_RECENT_RATE_LIMIT = {
  limit: 60,
  windowMs: 60_000,
};

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function parseDateOrNull(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function extractLabelUrlFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const candidate = (payload as { labelButtonUrl?: unknown }).labelButtonUrl;
  return typeof candidate === "string" && candidate.length > 0 ? candidate : null;
}

function parseStatuses(statusParam: string | null) {
  if (!statusParam || statusParam.trim().toLowerCase() === "all") {
    return { ok: true as const, statuses: [] as string[] };
  }

  const allowedSet = new Set<string>(ORDER_STATUS_ALLOW_LIST);
  const parsed = statusParam
    .split(",")
    .map((status) => status.trim().toLowerCase())
    .filter((status) => status.length > 0);

  const uniqueStatuses = Array.from(new Set(parsed));
  if (uniqueStatuses.length === 0) {
    return { ok: false as const, invalid: ["(empty)"] };
  }

  const invalid = uniqueStatuses.filter((status) => !allowedSet.has(status));
  if (invalid.length > 0) {
    return { ok: false as const, invalid };
  }

  return { ok: true as const, statuses: uniqueStatuses };
}

export async function GET(request: NextRequest) {
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
        message: "Active subscription required. Start trial in Billing to access order activity.",
        subscriptionStatus: entitlement.status,
      },
      { status: 402 },
    );
  }

  let rateLimitDecision: RateLimitDecision;
  try {
    rateLimitDecision = await consumeRateLimit({
      key: buildRateLimitKey("api_orders_recent_get", sessionUserId, getRequestIp(request)),
      limit: ORDERS_RECENT_RATE_LIMIT.limit,
      windowMs: ORDERS_RECENT_RATE_LIMIT.windowMs,
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
        message: "Too many order refresh requests. Please wait and try again.",
      },
      {
        status: 429,
        headers: buildRateLimitHeaders(rateLimitDecision),
      },
    );
  }

  const query = request.nextUrl.searchParams;
  const page = parsePositiveInt(query.get("page"), DEFAULT_PAGE);
  const pageSize = Math.min(parsePositiveInt(query.get("pageSize"), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  const now = new Date();
  const defaultDateFrom = new Date(now.getTime() - MS_IN_30_DAYS);
  const dateFrom = parseDateOrNull(query.get("dateFrom")) ?? defaultDateFrom;
  const dateTo = parseDateOrNull(query.get("dateTo")) ?? now;
  if (dateFrom > dateTo) {
    return NextResponse.json(
      { ok: false, error: "invalid_date_range", message: "dateFrom must be before or equal to dateTo" },
      { status: 400 },
    );
  }

  const parsedStatuses = parseStatuses(query.get("status"));
  if (!parsedStatuses.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_status_filter",
        message: `Allowed statuses: all, ${ORDER_STATUS_ALLOW_LIST.join(", ")}`,
        invalid: parsedStatuses.invalid,
      },
      { status: 400 },
    );
  }
  const statuses = parsedStatuses.statuses;

  const where = {
    userId: sessionUserId,
    createdAt: {
      gte: dateFrom,
      lte: dateTo,
    },
    ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip,
      take: pageSize,
      include: {
        lines: {
          select: {
            mlItemId: true,
            title: true,
            quantity: true,
            unitPrice: true,
          },
        },
        notifications: {
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
          select: {
            eventType: true,
            status: true,
            reason: true,
            createdAt: true,
            payload: true,
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json(
    {
      ok: true,
      filters: {
        status: statuses,
        dateFrom: dateFrom.toISOString(),
        dateTo: dateTo.toISOString(),
      },
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        hasNextPage: skip + orders.length < total,
      },
      orders: orders.map((order) => {
        const latestNotification = order.notifications[0] ?? null;
        const latestLabelNotification = order.notifications.find(
          (notification) => notification.eventType === "label_ready" && notification.status === "sent",
        );
        const labelUrl =
          extractLabelUrlFromPayload(latestLabelNotification?.payload) ??
          extractLabelUrlFromPayload(latestNotification?.payload);

        return {
          id: order.id,
          mlOrderId: order.mlOrderId,
          status: order.status,
          saleType: order.saleType,
          totalAmount: order.totalAmount === null ? null : Number(order.totalAmount),
          createdAt: order.createdAt,
          createdAtMl: order.createdAtMl,
          updatedAtMl: order.updatedAtMl,
          lastSeenAt: order.lastSeenAt,
          lines: order.lines.map((line) => ({
            mlItemId: line.mlItemId,
            title: line.title,
            quantity: line.quantity,
            unitPrice: line.unitPrice === null ? null : Number(line.unitPrice),
          })),
          latestNotification: latestNotification
            ? {
                eventType: latestNotification.eventType,
                status: latestNotification.status,
                reason: latestNotification.reason,
                createdAt: latestNotification.createdAt,
              }
            : null,
          labelUrl,
        };
      }),
    },
    {
      status: 200,
      headers: buildRateLimitHeaders(rateLimitDecision),
    },
  );
}
