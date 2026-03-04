export function buildTelegramConnectedMessage() {
  return [
    "MercadoLibs connected successfully.",
    "You will receive stock alerts here once notifications are enabled.",
  ].join("\n");
}

export function buildTelegramConnectionExpiredMessage() {
  return "Connection link expired. Please reconnect from the dashboard to generate a new link.";
}

export function buildTelegramTestPingMessage() {
  return [
    "Test alert from MercadoLibs.",
    "Telegram connection is active and ready for stock notifications.",
  ].join("\n");
}

export function buildItemSoldMessage(input: {
  itemTitle: string;
  itemId: string;
  previousStock: number;
  currentStock: number;
  soldUnits: number;
  permalink?: string | null;
}) {
  const base = [
    "Item sold",
    `${input.itemTitle}`,
    `Units sold: ${input.soldUnits}`,
    `Stock: ${input.previousStock} -> ${input.currentStock}`,
    `Item: ${input.itemId}`,
  ];

  if (input.permalink) {
    base.push(`Link: ${input.permalink}`);
  }

  return base.join("\n");
}

export function buildOrderSoldMessage(input: {
  orderId: string;
  status?: string;
  totalAmount?: number;
  lines: Array<{
    itemId: string;
    title: string;
    quantity: number;
  }>;
}) {
  const totalUnits = input.lines.reduce((sum, line) => sum + line.quantity, 0);
  const lineSummary = input.lines
    .slice(0, 3)
    .map((line) => `- ${line.quantity} x ${line.title}`)
    .join("\n");

  const message = [
    "Order sold",
    `Order: ${input.orderId}`,
    `Units: ${totalUnits}`,
    input.status ? `Status: ${input.status}` : null,
    Number.isFinite(input.totalAmount) ? `Total: ${input.totalAmount}` : null,
    lineSummary.length > 0 ? lineSummary : null,
    input.lines.length > 3 ? `+${input.lines.length - 3} more items` : null,
  ].filter(Boolean);

  return message.join("\n");
}

export function buildOutOfStockMessage(input: {
  itemId: string;
  itemTitle: string;
  previousStock: number;
  currentStock: number;
  source: "orders_v2" | "items";
}) {
  return [
    "Out of stock",
    input.itemTitle,
    `Item: ${input.itemId}`,
    `Stock: ${input.previousStock} -> ${input.currentStock}`,
    `Source: ${input.source}`,
  ].join("\n");
}
