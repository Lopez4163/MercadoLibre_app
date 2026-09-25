import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  class RateLimitConfigurationError extends Error {}
  class RateLimitUnavailableError extends Error {}

  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
      },
      feedback: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    },
    getSessionUserIdFromRequest: vi.fn(),
    consumeRateLimit: vi.fn(),
    buildRateLimitKey: vi.fn(() => "rate:key"),
    getRequestIp: vi.fn(() => "127.0.0.1"),
    buildRateLimitHeaders: vi.fn(() => ({ "X-RateLimit-Limit": "5" })),
    RateLimitConfigurationError,
    RateLimitUnavailableError,
  };
});

vi.mock("../../../../lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("../../../../lib/auth/session", () => ({
  getSessionUserIdFromRequest: mocks.getSessionUserIdFromRequest,
}));
vi.mock("../../../../lib/utils/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  buildRateLimitKey: mocks.buildRateLimitKey,
  getRequestIp: mocks.getRequestIp,
  buildRateLimitHeaders: mocks.buildRateLimitHeaders,
  RateLimitConfigurationError: mocks.RateLimitConfigurationError,
  RateLimitUnavailableError: mocks.RateLimitUnavailableError,
}));

import { POST } from "./route";

function makeRequest(body: Record<string, unknown>) {
  return {
    headers: new Headers(),
    cookies: { get: vi.fn() },
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSessionUserIdFromRequest.mockReturnValue("user_1");
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "user_1" });
    mocks.consumeRateLimit.mockResolvedValue({
      allowed: true,
      limit: 5,
      remaining: 4,
      resetAt: Date.now() + 15 * 60_000,
      retryAfterSeconds: 0,
    });
    mocks.prisma.feedback.findFirst.mockResolvedValue(null);
    mocks.prisma.feedback.create.mockResolvedValue({
      id: "feedback_1",
      category: "bug",
      message: "Something is broken in the notifications flow.",
      pagePath: "/settings/notifications",
      createdAt: new Date().toISOString(),
    });
  });

  it("returns 429 when the user exceeds the feedback rate limit", async () => {
    mocks.consumeRateLimit.mockResolvedValue({
      allowed: false,
      limit: 5,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 60,
    });

    const response = await POST(
      makeRequest({
        category: "bug",
        message: "Something is broken in the notifications flow.",
        pagePath: "/settings/notifications",
      }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "rate_limited",
    });
    expect(mocks.prisma.feedback.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.feedback.create).not.toHaveBeenCalled();
  });

  it("returns 409 for duplicate feedback within the duplicate window", async () => {
    mocks.prisma.feedback.findFirst.mockResolvedValue({ id: "feedback_existing" });

    const response = await POST(
      makeRequest({
        category: "bug",
        message: "Something is broken in the notifications flow.",
        pagePath: "/settings/notifications",
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "duplicate_feedback",
    });
    expect(mocks.prisma.feedback.create).not.toHaveBeenCalled();
  });

  it("rejects honeypot submissions", async () => {
    const response = await POST(
      makeRequest({
        category: "bug",
        message: "Something is broken in the notifications flow.",
        pagePath: "/settings/notifications",
        website: "https://spam.example",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "invalid_submission",
    });
    expect(mocks.prisma.feedback.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.feedback.create).not.toHaveBeenCalled();
  });

  it("creates feedback when the payload is valid and not throttled", async () => {
    const response = await POST(
      makeRequest({
        category: "bug",
        message: "Something is broken in the notifications flow.",
        pagePath: "/settings/notifications",
        website: "",
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      entry: expect.objectContaining({
        id: "feedback_1",
        category: "bug",
      }),
    });
    expect(mocks.prisma.feedback.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user_1",
          category: "bug",
          message: "Something is broken in the notifications flow.",
          pagePath: "/settings/notifications",
        }),
      }),
    );
    expect(mocks.prisma.feedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user_1",
          category: "bug",
          message: "Something is broken in the notifications flow.",
          pagePath: "/settings/notifications",
        }),
      }),
    );
  });
});
