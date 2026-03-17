import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/prisma";
import { getSessionUserIdFromRequest } from "../../../../lib/auth/session";
import {
  buildRateLimitHeaders,
  buildRateLimitKey,
  consumeRateLimit,
  getRequestIp,
  RateLimitConfigurationError,
  RateLimitUnavailableError,
  type RateLimitDecision,
} from "../../../../lib/utils/rate-limit";

const ALLOWED_CATEGORIES = new Set([
  "bug",
  "feature_request",
  "confusing_ux",
  "billing_issue",
  "general",
]);

const FEEDBACK_POST_RATE_LIMIT = {
  limit: 5,
  windowMs: 15 * 60 * 1000,
};

const FEEDBACK_DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

type FeedbackPayload = {
  category?: unknown;
  message?: unknown;
  pagePath?: unknown;
  website?: unknown;
};

function normalizeOptionalPagePath(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, 240);
}

async function getSessionUser(request: NextRequest) {
  const sessionUserId = getSessionUserIdFromRequest(request);
  if (!sessionUserId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true },
  });
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const entries = await prisma.feedback.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      category: true,
      message: true,
      pagePath: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, entries }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let rateLimitDecision: RateLimitDecision;
  try {
    rateLimitDecision = await consumeRateLimit({
      key: buildRateLimitKey("api_feedback_post", user.id, getRequestIp(request)),
      limit: FEEDBACK_POST_RATE_LIMIT.limit,
      windowMs: FEEDBACK_POST_RATE_LIMIT.windowMs,
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
        message: "Too many feedback submissions. Please wait and try again.",
      },
      {
        status: 429,
        headers: buildRateLimitHeaders(rateLimitDecision),
      },
    );
  }

  let payload: FeedbackPayload;
  try {
    payload = (await request.json()) as FeedbackPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (typeof payload.category !== "string" || !ALLOWED_CATEGORIES.has(payload.category)) {
    return NextResponse.json({ ok: false, error: "invalid_category" }, { status: 400 });
  }

  if (typeof payload.message !== "string") {
    return NextResponse.json({ ok: false, error: "invalid_message" }, { status: 400 });
  }

  if (typeof payload.website === "string" && payload.website.trim().length > 0) {
    return NextResponse.json({ ok: false, error: "invalid_submission" }, { status: 400 });
  }

  const message = payload.message.trim();
  if (message.length < 10 || message.length > 4000) {
    return NextResponse.json({ ok: false, error: "invalid_message_length" }, { status: 400 });
  }

  const pagePath = normalizeOptionalPagePath(payload.pagePath);
  const duplicateSince = new Date(Date.now() - FEEDBACK_DUPLICATE_WINDOW_MS);
  const recentDuplicate = await prisma.feedback.findFirst({
    where: {
      userId: user.id,
      category: payload.category,
      message,
      pagePath,
      createdAt: {
        gte: duplicateSince,
      },
    },
    select: { id: true },
  });

  if (recentDuplicate) {
    return NextResponse.json(
      {
        ok: false,
        error: "duplicate_feedback",
        message: "That feedback was already submitted recently.",
      },
      { status: 409, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  }

  const entry = await prisma.feedback.create({
    data: {
      userId: user.id,
      category: payload.category,
      message,
      pagePath,
      userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
    },
    select: {
      id: true,
      category: true,
      message: true,
      pagePath: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, entry }, { status: 201, headers: buildRateLimitHeaders(rateLimitDecision) });
}
