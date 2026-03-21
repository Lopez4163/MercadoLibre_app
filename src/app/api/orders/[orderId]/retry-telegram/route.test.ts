import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => {
  class RateLimitConfigurationError extends Error {}
  class RateLimitUnavailableError extends Error {}

  return {
    prisma: {
      order: {
        findFirst: vi.fn(),
      },
      orderNotificationLog: {
        create: vi.fn(),
      },
    },
    getSessionUserIdFromRequest: vi.fn(),
    getUserBillingEntitlement: vi.fn(),
    consumeRateLimit: vi.fn(),
    buildRateLimitKey: vi.fn(() => "rate:key"),
    getRequestIp: vi.fn(() => "127.0.0.1"),
    buildRateLimitHeaders: vi.fn(() => ({ "X-RateLimit-Limit": "10" })),
    sendOrderSoldNotification: vi.fn(),
    sendOrderLabelReadyNotification: vi.fn(),
    RateLimitConfigurationError,
    RateLimitUnavailableError,
  };
});

vi.mock("../../../../../../lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("../../../../../../lib/auth/session", () => ({
  getSessionUserIdFromRequest: mocks.getSessionUserIdFromRequest,
}));
vi.mock("../../../../../../lib/billing/entitlements", () => ({
  getUserBillingEntitlement: mocks.getUserBillingEntitlement,
}));
vi.mock("../../../../../../lib/notifications/sender", () => ({
  sendOrderSoldNotification: mocks.sendOrderSoldNotification,
  sendOrderLabelReadyNotification: mocks.sendOrderLabelReadyNotification,
}));
vi.mock("../../../../../../lib/utils/rate-limit", () => ({
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

function makeContext(orderId = "order_db_1") {
  return { params: Promise.resolve({ orderId }) };
}

describe("POST /api/orders/[orderId]/retry-telegram", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getSessionUserIdFromRequest.mockReturnValue("user_1");
    mocks.getUserBillingEntitlement.mockResolvedValue({ hasAccess: true, status: "active" });
    mocks.consumeRateLimit.mockResolvedValue({
      allowed: true,
      limit: 10,
      remaining: 9,
      resetAt: Date.now() + 60_000,
      retryAfterSeconds: 0,
    });
  });

  it("retries latest failed label_ready notification when shipment context exists", async () => {
    mocks.prisma.order.findFirst.mockResolvedValue({
      id: "order_db_1",
      mlOrderId: "ML-123",
      status: "paid",
      totalAmount: 120.5,
      lines: [
        { mlItemId: "MLA1", title: "Printer Paper", quantity: 2 },
        { mlItemId: "MLA2", title: "Thermal Label", quantity: 1 },
      ],
      notifications: [
        {
          eventType: "label_ready",
          status: "failed",
          payload: {
            shipmentId: "SHIP-1",
            destinationCity: "Buenos Aires",
            saleType: "fulfillment",
          },
        },
      ],
    });
    mocks.sendOrderLabelReadyNotification.mockResolvedValue({ sent: true });

    const response = await POST(makeRequest(), makeContext("order_db_1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, sent: true, reason: null });
    expect(mocks.sendOrderLabelReadyNotification).toHaveBeenCalledWith({
      userId: "user_1",
      orderId: "ML-123",
      shipmentId: "SHIP-1",
      destinationCity: "Buenos Aires",
      saleType: "fulfillment",
      lines: [
        { title: "Printer Paper", quantity: 2 },
        { title: "Thermal Label", quantity: 1 },
      ],
    });
    expect(mocks.prisma.orderNotificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order_db_1",
        channel: "telegram",
        eventType: "label_ready",
        status: "sent",
        reason: null,
      }),
    });
  });

  it("returns missing_retry_context for label_ready without shipmentId payload", async () => {
    mocks.prisma.order.findFirst.mockResolvedValue({
      id: "order_db_1",
      mlOrderId: "ML-123",
      status: "paid",
      totalAmount: 120.5,
      lines: [{ mlItemId: "MLA1", title: "Printer Paper", quantity: 2 }],
      notifications: [
        {
          eventType: "label_ready",
          status: "failed",
          payload: {
            destinationCity: "Buenos Aires",
          },
        },
      ],
    });

    const response = await POST(makeRequest(), makeContext("order_db_1"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "missing_retry_context" });
    expect(mocks.sendOrderLabelReadyNotification).not.toHaveBeenCalled();
    expect(mocks.prisma.orderNotificationLog.create).not.toHaveBeenCalled();
  });

  it("keeps order_sold retry behavior unchanged", async () => {
    mocks.prisma.order.findFirst.mockResolvedValue({
      id: "order_db_1",
      mlOrderId: "ML-123",
      status: "paid",
      totalAmount: 120.5,
      lines: [{ mlItemId: "MLA1", title: "Printer Paper", quantity: 2 }],
      notifications: [
        {
          eventType: "order_sold",
          status: "failed",
          payload: null,
        },
      ],
    });
    mocks.sendOrderSoldNotification.mockResolvedValue({
      sent: false,
      reason: "telegram_send_failed",
    });

    const response = await POST(makeRequest(), makeContext("order_db_1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      sent: false,
      reason: "telegram_send_failed",
    });
    expect(mocks.sendOrderSoldNotification).toHaveBeenCalledWith({
      userId: "user_1",
      orderId: "ML-123",
      status: "paid",
      totalAmount: 120.5,
      lines: [{ itemId: "MLA1", title: "Printer Paper", quantity: 2 }],
    });
    expect(mocks.prisma.orderNotificationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderId: "order_db_1",
        channel: "telegram",
        eventType: "order_sold",
        status: "failed",
        reason: "telegram_send_failed",
      }),
    });
  });
});
