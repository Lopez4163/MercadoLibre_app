import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  class RateLimitConfigurationError extends Error {}
  class RateLimitUnavailableError extends Error {}

  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
    getSessionUserIdFromRequest: vi.fn(),
    getUserBillingEntitlement: vi.fn(),
    consumeRateLimit: vi.fn(),
    buildRateLimitKey: vi.fn(() => "rate:key"),
    getRequestIp: vi.fn(() => "127.0.0.1"),
    buildRateLimitHeaders: vi.fn(() => ({ "X-RateLimit-Limit": "10" })),
    getStripe: vi.fn(),
    getStripePriceId: vi.fn(() => "price_basic"),
    stripe: {
      customers: {
        create: vi.fn(),
      },
      checkout: {
        sessions: {
          create: vi.fn(),
        },
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
vi.mock("../../../../../lib/billing/entitlements", () => ({
  getUserBillingEntitlement: mocks.getUserBillingEntitlement,
}));
vi.mock("../../../../../lib/stripe/client", () => ({
  getStripe: mocks.getStripe,
  getStripePriceId: mocks.getStripePriceId,
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
    nextUrl: new URL("http://localhost:3000"),
    cookies: { get: vi.fn() },
  } as unknown as NextRequest;
}

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.APP_BASE_URL;
    delete process.env.STRIPE_TRIAL_DAYS;

    mocks.consumeRateLimit.mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 0,
    });
    mocks.getStripe.mockReturnValue(mocks.stripe);
  });

  it("returns unauthorized when there is no session", async () => {
    mocks.getSessionUserIdFromRequest.mockReturnValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "unauthorized" });
  });

  it("returns alreadyEntitled when user already has access", async () => {
    mocks.getSessionUserIdFromRequest.mockReturnValue("user_1");
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "user_1", email: "seller@example.com", stripeCustomerId: "cus_1" });
    mocks.getUserBillingEntitlement.mockResolvedValue({ hasAccess: true, status: "active" });

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, alreadyEntitled: true, status: "active" });
    expect(mocks.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("creates customer and checkout session when user is not entitled", async () => {
    mocks.getSessionUserIdFromRequest.mockReturnValue("user_1");
    mocks.prisma.user.findUnique.mockResolvedValue({ id: "user_1", email: "seller@example.com", stripeCustomerId: null });
    mocks.getUserBillingEntitlement.mockResolvedValue({ hasAccess: false, status: null });
    mocks.stripe.customers.create.mockResolvedValue({ id: "cus_new" });
    mocks.stripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_1",
      url: "https://checkout.stripe.com/session/cs_1",
    });
    process.env.STRIPE_TRIAL_DAYS = "7";

    const response = await POST(makeRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, sessionId: "cs_1" });

    expect(mocks.prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { stripeCustomerId: "cus_new" },
    });

    expect(mocks.stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer: "cus_new",
        line_items: [{ price: "price_basic", quantity: 1 }],
        subscription_data: {
          metadata: { userId: "user_1" },
          trial_period_days: 7,
        },
      }),
    );
  });
});
