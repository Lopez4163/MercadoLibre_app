import { describe, expect, it } from "vitest";
import { verifyMlWebhookSecret } from "./webhook-auth";

describe("verifyMlWebhookSecret", () => {
  it("allows request when expected secret is not configured", () => {
    expect(
      verifyMlWebhookSecret({
        expectedSecret: undefined,
        providedSecret: null,
      }),
    ).toBe(true);
  });

  it("accepts matching header/query secret", () => {
    expect(
      verifyMlWebhookSecret({
        expectedSecret: "abc123",
        providedSecret: "abc123",
      }),
    ).toBe(true);
  });

  it("rejects request when secret is missing", () => {
    expect(
      verifyMlWebhookSecret({
        expectedSecret: "abc123",
        providedSecret: null,
      }),
    ).toBe(false);
  });

  it("rejects request when secret is invalid", () => {
    expect(
      verifyMlWebhookSecret({
        expectedSecret: "abc123",
        providedSecret: "wrong",
      }),
    ).toBe(false);
  });
});
