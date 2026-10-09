import { describe, expect, it } from "vitest";

import {
  canRefreshFulfillmentQueue,
  FULFILLMENT_QUEUE_REFRESH_INTERVAL_MS,
} from "./fulfillment-queue-refresh";

describe("fulfillment queue refresh policy", () => {
  it("uses a modest visible-page refresh interval", () => {
    expect(FULFILLMENT_QUEUE_REFRESH_INTERVAL_MS).toBe(15_000);
  });

  it("refreshes only while the page is visible", () => {
    expect(canRefreshFulfillmentQueue("visible")).toBe(true);
    expect(canRefreshFulfillmentQueue("hidden")).toBe(false);
    expect(canRefreshFulfillmentQueue("prerender")).toBe(false);
  });
});
