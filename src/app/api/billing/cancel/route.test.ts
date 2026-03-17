import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  class RateLimitConfigurationError extends Error {}
  class RateLimitUnavailableError extends Error {}

  return {
    prisma: {
      billingSubscription: {
        findUnique: vi.fn(),
        updateMany: vi.fn(),
      },
    },
    getSessionUserIdFromRequest: vi.fn(),
    consumeRateLimit: vi.fn(),
    buildRateLimitKey: vi.fn(() => "rate:key"),
    getRequestIp: vi.fn(() => "127.0.0.1"),
    buildRateLimitHeaders: vi.fn(() => ({ "X-RateLimit-Limit": "10" })),
    getStripe: vi.fn(),
    stripe: {
      subscriptions: {
        update: vi.fn(),
      },
    },
    RateLimitConfigurationError,
    RateLimitUnavailableError,
  };
});

vi.mock("../../../../../lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("../../../../../lib/auth/session", () => ({
  getSessionUserIdFromRequest: mocks.getSessionUserIdFromRequest,
}));
vi.mock("../../../../../lib/stripe/client", () => ({
  getStripe: mocks.getStripe,
}));
vi.mock("../../../../../lib/utils/rate-limit", () => ({
  consumeRateLimit: mocks.consumeRateLimit,
  buildRateLimitKey: mocks.buildRateLimitKey,
  getRequestIp: mocks.getRequestIp,
  buildRateLimitHeaders: mocks.buildRateLimitHeaders,
  RateLimitConfigurationError: mocks.RateLimitConfigurationError,
  RateLimitUnavailableError: mocks.RateLimitUnavailableError,
}));

import { POST } from "./route";

function makeRequest() {
  return {
    headers: new Headers(),
    cookies: { get: vi.fn() },
  } as unknown as NextRequest;
}

describe("POST /api/billing/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeRateLimit.mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 0,
    });
    mocks.getStripe.mockReturnValue(mocks.stripe);
  });

  it("returns alreadyScheduled when cancellation is already set", async () => {
    mocks.getSessionUserIdFromRequest.mockReturnValue("user_1");
    mocks.prisma.billingSubscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: "sub_1",
      status: "active",
      cancelAtPeriodEnd: true,
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      alreadyScheduled: true,
      cancelAtPeriodEnd: true,
    });
    expect(mocks.stripe.subscriptions.update).not.toHaveBeenCalled();
  });

  it("schedules cancellation in Stripe and updates local state", async () => {
    mocks.getSessionUserIdFromRequest.mockReturnValue("user_1");
    mocks.prisma.billingSubscription.findUnique.mockResolvedValue({
      stripeSubscriptionId: "sub_1",
      status: "active",
      cancelAtPeriodEnd: false,
    });
    mocks.stripe.subscriptions.update.mockResolvedValue({
      status: "active",
      cancel_at_period_end: true,
      canceled_at: null,
      items: { data: [{ current_period_end: 1_770_000_000 }] },
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, cancelAtPeriodEnd: true });
    expect(mocks.prisma.billingSubscription.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user_1" },
        data: expect.objectContaining({ cancelAtPeriodEnd: true, status: "active" }),
      }),
    );
  });
});
