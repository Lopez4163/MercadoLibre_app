import { describe, expect, it, vi } from "vitest";
import { RetryableRequestError, withRetry } from "./retry";

describe("withRetry", () => {
  it("retries retryable failures and then succeeds", async () => {
    const operation = vi
      .fn<(_: number) => Promise<string>>()
      .mockRejectedValueOnce(new RetryableRequestError("temporary"))
      .mockRejectedValueOnce(new RetryableRequestError("temporary"))
      .mockResolvedValue("ok");

    const result = await withRetry(operation, {
      maxAttempts: 3,
      baseDelayMs: 1,
      maxDelayMs: 1,
    });

    expect(result).toBe("ok");
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it("does not retry non-retryable errors", async () => {
    const operation = vi
      .fn<(_: number) => Promise<string>>()
      .mockRejectedValue(new Error("bad request"));

    await expect(
      withRetry(operation, {
        maxAttempts: 3,
        baseDelayMs: 1,
        maxDelayMs: 1,
      }),
    ).rejects.toThrow("bad request");

    expect(operation).toHaveBeenCalledTimes(1);
  });
});
