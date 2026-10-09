import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { FulfillmentQueue } from "../../lib/v2/api";
import { FulfillmentQueueContent } from "./FulfillmentQueuePanel";

function queue(overrides: Partial<FulfillmentQueue> = {}): FulfillmentQueue {
  return {
    dispatchState: "READY",
    activeAssignment: null,
    queued: [],
    needsAttention: [],
    recentCompleted: [],
    ...overrides,
  };
}

function job(id: string, overrides: Partial<FulfillmentQueue["queued"][number]> = {}) {
  return {
    jobId: id,
    shipmentId: id,
    orderId: `order-${id}`,
    status: "QUEUED",
    shipmentStatus: "ready_to_ship",
    shipmentSubstatus: "ready_to_print",
    createdAt: "2026-10-09T12:00:00Z",
    fulfillmentSnapshotState: "AVAILABLE" as const,
    totalUnits: 3,
    items: [
      {
        itemId: `item-${id}-shirt`,
        title: "Black T-Shirt",
        quantity: 2,
        sellerSku: "SHIRT-BLK-M",
        variationSummary: "Black / M",
      },
      {
        itemId: `item-${id}-cap`,
        title: "Baseball Cap",
        quantity: 1,
        sellerSku: null,
        variationSummary: null,
      },
    ],
    ...overrides,
  };
}

describe("FulfillmentQueueContent", () => {
  it.each([
    ["READY", "Ready", "The next shipment is eligible for dispatch."],
    ["OCCUPIED", "Active assignment", "Waiting for the current shipment to finish."],
    ["BLOCKED", "Needs attention", "Printing is blocked until the current issue is resolved."],
    ["PAUSED", "Paused", "Automatic dispatch is paused."],
    ["NO_ACTIVE_DEVICE", "No active device", "Connect an Agent before jobs can be dispatched."],
  ] as const)("renders %s dispatch state honestly", (dispatchState, title, detail) => {
    const output = renderToStaticMarkup(
      <FulfillmentQueueContent queue={queue({ dispatchState })} />,
    );

    expect(output).toContain(title);
    expect(output).toContain(detail);
  });

  it("preserves backend queue order in the read-only table", () => {
    const first = job("48206971947");
    const second = job("48206971948", { items: [], totalUnits: 0 });
    const output = renderToStaticMarkup(
      <FulfillmentQueueContent queue={queue({ queued: [first, second] })} />,
    );

    expect(output.indexOf("Shipment #48206971947")).toBeLessThan(
      output.indexOf("Shipment #48206971948"),
    );
    expect(output).toContain("Packing details");
    expect(output).toContain("2 × Black T-Shirt · SKU: SHIRT-BLK-M · Black / M");
    expect(output).not.toContain('aria-expanded="false"');
  });

  it("shows active, pending, unavailable, attention, and completed sections read-only", () => {
    const active = job("active", { status: "SENT_TO_AGENT" });
    const pending = job("pending", { fulfillmentSnapshotState: "PENDING", items: [] });
    const unavailable = job("unavailable", { fulfillmentSnapshotState: "UNAVAILABLE", items: [] });
    const attention = job("attention", { status: "NEEDS_ATTENTION" });
    const completed = job("completed", { status: "PRINTED_SUCCESSFULLY" });
    const output = renderToStaticMarkup(
      <FulfillmentQueueContent
        queue={queue({
          dispatchState: "OCCUPIED",
          activeAssignment: { attemptId: "attempt-1", attemptStatus: "RECEIVED", job: active },
          queued: [pending, unavailable],
          needsAttention: [attention],
          recentCompleted: [completed],
        })}
      />,
    );

    expect(output).toContain("Current");
    expect(output).toContain("Attempt RECEIVED");
    expect(output).toContain("2 × Black T-Shirt");
    expect(output).toContain("SKU: SHIRT-BLK-M");
    expect(output).toContain("Packing details pending");
    expect(output).toContain("Packing details unavailable");
    expect(output).toContain("Needs attention · 1");
    expect(output).toContain("Recently completed");
    expect(output).not.toMatch(/Print Now|Retry Print|Requeue|Cancel|Resolve UNKNOWN|Manual Print|Download Label|Test Print/);
  });

  it("shows a calm empty state", () => {
    const output = renderToStaticMarkup(<FulfillmentQueueContent queue={queue()} />);

    expect(output).toContain("Queue is clear");
    expect(output).toContain("New eligible Mercado Libre shipments will appear here.");
  });
});
