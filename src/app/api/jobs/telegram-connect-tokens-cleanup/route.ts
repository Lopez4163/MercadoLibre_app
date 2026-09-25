import { NextRequest, NextResponse } from "next/server";
import { cleanupTelegramConnectTokens } from "../../../../../lib/telegram/connect-token-cleanup";
import {
  buildRateLimitHeaders,
  buildRateLimitKey,
  consumeRateLimit,
  getRequestIp,
  RateLimitConfigurationError,
  RateLimitUnavailableError,
  type RateLimitDecision,
} from "../../../../../lib/utils/rate-limit";

const TELEGRAM_CONNECT_TOKENS_CLEANUP_RATE_LIMIT = {
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
  const secret = process.env.TELEGRAM_CONNECT_TOKENS_CLEANUP_CRON_SECRET;
  if (!secret) {
    return false;
  }

  const headerSecret = request.headers.get("x-telegram-connect-tokens-cleanup-secret");
  return headerSecret === secret;
}

export async function POST(request: NextRequest) {
  const requestIp = getRequestIp(request);
  const isProduction = process.env.NODE_ENV === "production";
  const allowedIps = parseAllowedIps(process.env.TELEGRAM_CONNECT_TOKENS_CLEANUP_ALLOWED_IPS);

  if (isProduction && !isIpAllowed(requestIp, allowedIps)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let rateLimitDecision: RateLimitDecision;
  try {
    rateLimitDecision = await consumeRateLimit({
      key: buildRateLimitKey("api_jobs_telegram_connect_tokens_cleanup_post", "cron", requestIp),
      limit: TELEGRAM_CONNECT_TOKENS_CLEANUP_RATE_LIMIT.limit,
      windowMs: TELEGRAM_CONNECT_TOKENS_CLEANUP_RATE_LIMIT.windowMs,
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
    const result = await cleanupTelegramConnectTokens();

    return NextResponse.json(
      {
        ok: true,
        schedule: "every_12_hours",
        cutoff: result.cutoffIso,
        deletedUsedTokens: result.deletedUsedTokens,
        deletedExpiredUnusedTokens: result.deletedExpiredUnusedTokens,
        deletedTotal: result.deletedTotal,
      },
      { status: 200, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  } catch (error) {
    console.error("telegram connect token cleanup failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: "telegram_connect_token_cleanup_failed",
      },
      { status: 500 },
    );
  }
}
