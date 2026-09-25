import { describe, expect, it } from "vitest";
import { createSessionToken, getSessionUserId } from "./session";

describe("session token", () => {
  it("returns user id for a valid signed token", () => {
    const now = new Date("2026-03-08T12:00:00.000Z");
    const token = createSessionToken("user-123", {
      now,
      secret: "test-secret",
      ttlSeconds: 300,
    });

    const userId = getSessionUserId(token, {
      now: new Date("2026-03-08T12:01:00.000Z"),
      secret: "test-secret",
    });

    expect(userId).toBe("user-123");
  });

  it("rejects expired token", () => {
    const token = createSessionToken("user-123", {
      now: new Date("2026-03-08T12:00:00.000Z"),
      secret: "test-secret",
      ttlSeconds: 60,
    });

    const userId = getSessionUserId(token, {
      now: new Date("2026-03-08T12:01:00.000Z"),
      secret: "test-secret",
    });

    expect(userId).toBeNull();
  });

  it("rejects token when signature does not match", () => {
    const token = createSessionToken("user-123", {
      secret: "test-secret",
    });
    const tamperedToken = `${token}a`;

    const userId = getSessionUserId(tamperedToken, {
      secret: "test-secret",
    });

    expect(userId).toBeNull();
  });

  it("rejects malformed token", () => {
    const userId = getSessionUserId("not-a-valid-token", {
      secret: "test-secret",
    });

    expect(userId).toBeNull();
  });
});
