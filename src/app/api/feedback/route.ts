import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db/prisma";
import { getSessionUserIdFromRequest } from "../../../../lib/auth/session";

const ALLOWED_CATEGORIES = new Set([
  "bug",
  "feature_request",
  "confusing_ux",
  "billing_issue",
  "general",
]);

type FeedbackPayload = {
  category?: unknown;
  message?: unknown;
  pagePath?: unknown;
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

  const message = payload.message.trim();
  if (message.length < 10 || message.length > 4000) {
    return NextResponse.json({ ok: false, error: "invalid_message_length" }, { status: 400 });
  }

  const entry = await prisma.feedback.create({
    data: {
      userId: user.id,
      category: payload.category,
      message,
      pagePath: normalizeOptionalPagePath(payload.pagePath),
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

  return NextResponse.json({ ok: true, entry }, { status: 201 });
}
