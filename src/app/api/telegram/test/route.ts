import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { sendTelegramMessage } from "../../../../../lib/telegram/bot";
import { buildTelegramTestPingMessage } from "../../../../../lib/telegram/messages";
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

const TELEGRAM_TEST_RATE_LIMIT = {
  limit: 5,
  windowMs: 60_000,
};

export async function POST(request: NextRequest) {
  const sessionUserId = getSessionUserIdFromRequest(request);
  if (!sessionUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let rateLimitDecision: RateLimitDecision;
  try {
    rateLimitDecision = await consumeRateLimit({
      key: buildRateLimitKey("api_telegram_test_post", sessionUserId, getRequestIp(request)),
      limit: TELEGRAM_TEST_RATE_LIMIT.limit,
      windowMs: TELEGRAM_TEST_RATE_LIMIT.windowMs,
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
        message: "Too many Telegram test requests. Please wait and try again.",
      },
      {
        status: 429,
        headers: buildRateLimitHeaders(rateLimitDecision),
      },
    );
  }

  const account = await prisma.telegramAccount.findUnique({
    where: { userId: sessionUserId },
    select: { chatId: true },
  });

  if (!account?.chatId) {
    return NextResponse.json({ ok: false, error: "telegram_not_connected" }, { status: 400 });
  }

  try {
    await sendTelegramMessage(account.chatId, buildTelegramTestPingMessage());
    return NextResponse.json({ ok: true }, { status: 200, headers: buildRateLimitHeaders(rateLimitDecision) });
  } catch (error) {
    console.error("telegram test ping failed", error);
    return NextResponse.json(
      { ok: false, error: "telegram_send_failed" },
      { status: 502, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  }
}
