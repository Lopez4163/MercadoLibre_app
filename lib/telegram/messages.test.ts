import { describe, expect, it } from "vitest";
import { buildOrderSoldMessageWithOverflow } from "./messages";

function buildLine(index: number, titleRepeat = 1) {
  return {
    itemId: `MLA-${index}`,
    quantity: 1,
    title: `Item ${index} ${"LONG_TITLE ".repeat(titleRepeat).trim()}`,
  };
}

describe("buildOrderSoldMessageWithOverflow", () => {
  it("keeps compact orders in a single primary message", () => {
    const result = buildOrderSoldMessageWithOverflow({
      orderId: "123",
      status: "paid",
      totalAmount: 100000,
      lines: [buildLine(1), buildLine(2), buildLine(3)],
    });

    expect(result.primaryMessage).toContain("✅ ORDER SOLD");
    expect(result.primaryMessage).toContain("Line items:");
    expect(result.primaryMessage).not.toContain("+more");
    expect(result.overflowMessages).toHaveLength(0);
  });

  it("splits overflow item lines into follow-up messages", () => {
    const result = buildOrderSoldMessageWithOverflow({
      orderId: "123",
      status: "paid",
      totalAmount: 100000,
      lines: Array.from({ length: 40 }, (_, index) => buildLine(index + 1, 8)),
    });

    expect(result.primaryMessage).toContain("Line items:");
    expect(result.primaryMessage).toMatch(/\+\d+ more/);
    expect(result.overflowMessages.length).toBeGreaterThan(0);
    expect(result.overflowMessages[0]).toContain("More line items (1):");
  });

  it("chunks very large overflow across multiple follow-up messages", () => {
    const result = buildOrderSoldMessageWithOverflow({
      orderId: "123",
      status: "paid",
      totalAmount: 100000,
      lines: Array.from({ length: 120 }, (_, index) => buildLine(index + 1, 24)),
    });

    expect(result.overflowMessages.length).toBeGreaterThan(1);
    for (const message of result.overflowMessages) {
      expect(message.length).toBeLessThanOrEqual(3500);
    }
  });
});
