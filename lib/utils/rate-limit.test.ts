import { describe, expect, it } from "vitest";
import { buildRateLimitKey, consumeRateLimit } from "./rate-limit";

describe("consumeRateLimit", () => {
  it("allows requests until the limit and then blocks", async () => {
    const key = buildRateLimitKey("test_scope", "user-1", "127.0.0.1");
    const nowMs = Date.now();

    const first = await consumeRateLimit({ key, limit: 2, windowMs: 60_000, nowMs });
    const second = await consumeRateLimit({ key, limit: 2, windowMs: 60_000, nowMs: nowMs + 1 });
    const third = await consumeRateLimit({ key, limit: 2, windowMs: 60_000, nowMs: nowMs + 2 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window expires", async () => {
    const key = buildRateLimitKey("test_scope_reset", "user-1", "127.0.0.1");
    const start = Date.now();

    const first = await consumeRateLimit({ key, limit: 1, windowMs: 1_000, nowMs: start });
    const blocked = await consumeRateLimit({ key, limit: 1, windowMs: 1_000, nowMs: start + 200 });
    const afterWindow = await consumeRateLimit({ key, limit: 1, windowMs: 1_000, nowMs: start + 1_001 });

    expect(first.allowed).toBe(true);
    expect(blocked.allowed).toBe(false);
    expect(afterWindow.allowed).toBe(true);
  });
});
