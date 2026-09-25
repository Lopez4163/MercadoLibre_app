import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import {
  buildRateLimitHeaders,
  buildRateLimitKey,
  consumeRateLimit,
  getRequestIp,
  RateLimitConfigurationError,
  RateLimitUnavailableError,
  type RateLimitDecision,
} from "../../../../../lib/utils/rate-limit";

const ORDERS_CLEANUP_RATE_LIMIT = {
  limit: 6,
  windowMs: 60 * 60 * 1000,
};

function parseAllowedIps(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isIpAllowed(requestIp: string, allowedIps: string[]) {
  if (allowedIps.length === 0) {
    return true;
  }

  return allowedIps.includes(requestIp);
}

function isAuthorized(request: NextRequest) {
  const secret = process.env.ORDERS_CLEANUP_CRON_SECRET;
  if (!secret) {
    return false;
  }

  const headerSecret = request.headers.get("x-orders-cleanup-secret");
  return headerSecret === secret;
}

export async function POST(request: NextRequest) {
  const requestIp = getRequestIp(request);
  const isProduction = process.env.NODE_ENV === "production";
  const allowedIps = parseAllowedIps(process.env.ORDERS_CLEANUP_ALLOWED_IPS);

  if (isProduction && !isIpAllowed(requestIp, allowedIps)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let rateLimitDecision: RateLimitDecision;
  try {
    rateLimitDecision = await consumeRateLimit({
      key: buildRateLimitKey("api_jobs_orders_cleanup_post", "cron", requestIp),
      limit: ORDERS_CLEANUP_RATE_LIMIT.limit,
      windowMs: ORDERS_CLEANUP_RATE_LIMIT.windowMs,
    });
  } catch (error) {
    if (error instanceof RateLimitConfigurationError || error instanceof RateLimitUnavailableError) {
      return NextResponse.json({ ok: false, error: "service_unavailable" }, { status: 500 });
    }
    throw error;
  }

  if (!rateLimitDecision.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      {
        status: 429,
        headers: buildRateLimitHeaders(rateLimitDecision),
      },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  }

  try {
    const now = new Date();
    const deleted = await prisma.order.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        schedule: "daily",
        cutoff: now.toISOString(),
        deletedOrders: deleted.count,
      },
      { status: 200, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  } catch (error) {
    console.error("orders cleanup failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: "orders_cleanup_failed",
      },
      { status: 500 },
    );
  }
}
