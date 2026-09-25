import { describe, expect, it } from "vitest";
import {
  BILLING_DISCONNECT_GRACE_MS,
  resolveDegradedSince,
  shouldDisconnectForBillingStatus,
} from "./disconnect-policy";

describe("resolveDegradedSince", () => {
  it("clears degradedSince when status is entitled", () => {
    const now = new Date("2026-03-17T00:00:00.000Z");

    expect(
      resolveDegradedSince({
        status: "active",
        previousStatus: "past_due",
        previousDegradedSince: new Date("2026-03-16T00:00:00.000Z"),
        now,
      }),
    ).toBeNull();
  });

  it("keeps existing degradedSince while still non-entitled", () => {
    const previous = new Date("2026-03-16T00:00:00.000Z");

    expect(
      resolveDegradedSince({
        status: "unpaid",
        previousStatus: "past_due",
        previousDegradedSince: previous,
        now: new Date("2026-03-17T00:00:00.000Z"),
      }),
    ).toEqual(previous);
  });

  it("sets degradedSince when first entering non-entitled status", () => {
    const now = new Date("2026-03-17T00:00:00.000Z");

    expect(
      resolveDegradedSince({
        status: "past_due",
        previousStatus: "active",
        previousDegradedSince: null,
        now,
      }),
    ).toEqual(now);
  });
});

describe("shouldDisconnectForBillingStatus", () => {
  it("disconnects immediately on terminal status", () => {
    expect(shouldDisconnectForBillingStatus("canceled", null, new Date("2026-03-17T00:00:00.000Z"))).toBe(true);
  });

  it("does not disconnect during unpaid grace window", () => {
    const degradedSince = new Date("2026-03-17T00:00:00.000Z");
    const now = new Date(degradedSince.getTime() + BILLING_DISCONNECT_GRACE_MS - 1);

    expect(shouldDisconnectForBillingStatus("unpaid", degradedSince, now)).toBe(false);
  });

  it("disconnects after unpaid grace window", () => {
    const degradedSince = new Date("2026-03-17T00:00:00.000Z");
    const now = new Date(degradedSince.getTime() + BILLING_DISCONNECT_GRACE_MS);

    expect(shouldDisconnectForBillingStatus("unpaid", degradedSince, now)).toBe(true);
  });
});
