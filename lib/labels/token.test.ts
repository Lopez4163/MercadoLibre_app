import { describe, expect, it } from "vitest";
import { createOrderLabelToken, getOrderLabelTokenPayload, isValidOrderLabelToken } from "./token";

describe("order label token", () => {
  it("returns payload for a valid signed token", () => {
    const now = new Date("2026-03-12T12:00:00.000Z");
    const token = createOrderLabelToken(
      {
        userId: "user-123",
        orderId: "order-456",
        shipmentId: "shipment-789",
      },
      {
        secret: "test-secret",
        now,
        ttlSeconds: 900,
      },
    );

    const payload = getOrderLabelTokenPayload(token, {
      secret: "test-secret",
      now: new Date("2026-03-12T12:05:00.000Z"),
    });

    expect(payload).toEqual({
      tokenId: expect.any(String),
      userId: "user-123",
      orderId: "order-456",
      shipmentId: "shipment-789",
      issuedAt: Math.floor(now.getTime() / 1000),
      expiresAt: Math.floor(now.getTime() / 1000) + 900,
    });
  });

  it("returns null for an expired token", () => {
    const token = createOrderLabelToken(
      {
        userId: "user-123",
        orderId: "order-456",
      },
      {
        secret: "test-secret",
        now: new Date("2026-03-12T12:00:00.000Z"),
        ttlSeconds: 60,
      },
    );

    const payload = getOrderLabelTokenPayload(token, {
      secret: "test-secret",
      now: new Date("2026-03-12T12:02:00.000Z"),
    });

    expect(payload).toBeNull();
  });

  it("rejects a tampered token", () => {
    const token = createOrderLabelToken(
      {
        userId: "user-123",
        orderId: "order-456",
      },
      {
        secret: "test-secret",
      },
    );

    const tamperedToken = `${token}a`;

    expect(
      getOrderLabelTokenPayload(tamperedToken, {
        secret: "test-secret",
      }),
    ).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(
      getOrderLabelTokenPayload("not-a-valid-token", {
        secret: "test-secret",
      }),
    ).toBeNull();
  });

  it("reports validity for a fresh token", () => {
    const token = createOrderLabelToken(
      {
        userId: "user-123",
        orderId: "order-456",
      },
      {
        secret: "test-secret",
        now: new Date("2026-03-12T12:00:00.000Z"),
        ttlSeconds: 300,
      },
    );

    expect(
      isValidOrderLabelToken(token, {
        secret: "test-secret",
        now: new Date("2026-03-12T12:04:00.000Z"),
      }),
    ).toBe(true);
  });

  it("reports invalidity for an expired token", () => {
    const token = createOrderLabelToken(
      {
        userId: "user-123",
        orderId: "order-456",
      },
      {
        secret: "test-secret",
        now: new Date("2026-03-12T12:00:00.000Z"),
        ttlSeconds: 60,
      },
    );

    expect(
      isValidOrderLabelToken(token, {
        secret: "test-secret",
        now: new Date("2026-03-12T12:02:00.000Z"),
      }),
    ).toBe(false);
  });

  it("caps TTL at 24 hours even when a longer ttlSeconds is requested", () => {
    const now = new Date("2026-03-12T12:00:00.000Z");
    const token = createOrderLabelToken(
      {
        userId: "user-123",
        orderId: "order-456",
      },
      {
        secret: "test-secret",
        now,
        ttlSeconds: 60 * 60 * 48,
      },
    );

    const payload = getOrderLabelTokenPayload(token, {
      secret: "test-secret",
      now: new Date("2026-03-13T11:59:00.000Z"),
    });
    expect(payload).not.toBeNull();

    const expiredPayload = getOrderLabelTokenPayload(token, {
      secret: "test-secret",
      now: new Date("2026-03-13T12:01:00.000Z"),
    });
    expect(expiredPayload).toBeNull();
  });
});
