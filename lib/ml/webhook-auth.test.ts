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

  it("rejects request when expected secret is not configured in strict mode", () => {
    expect(
      verifyMlWebhookSecret({
        expectedSecret: undefined,
        providedSecret: null,
        strict: true,
      }),
    ).toBe(false);
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

  it("accepts matching secret with surrounding quotes/whitespace", () => {
    expect(
      verifyMlWebhookSecret({
        expectedSecret: ' "abc123" ',
        providedSecret: " abc123 ",
      }),
    ).toBe(true);
  });

  it("accepts matching secret from a comma-separated allow-list", () => {
    expect(
      verifyMlWebhookSecret({
        expectedSecret: "new-secret, old-secret",
        providedSecret: "old-secret",
      }),
    ).toBe(true);
  });

  it("rejects malformed expected secret in strict mode", () => {
    expect(
      verifyMlWebhookSecret({
        expectedSecret: " , '   ' ",
        providedSecret: "anything",
        strict: true,
      }),
    ).toBe(false);
  });
});
