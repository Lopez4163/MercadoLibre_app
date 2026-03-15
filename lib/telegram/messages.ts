function formatCurrencyCOP(amount?: number) {
  if (!Number.isFinite(amount)) {
    return "-";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount as number);
}

function formatStatusLabel(status?: string) {
  if (!status) {
    return "Unknown";
  }

  const normalized = status.trim().toLowerCase();
  if (!normalized) {
    return "Unknown";
  }

  if (normalized === "paid") return "Paid";
  if (normalized === "pending") return "Pending";
  if (normalized === "cancelled") return "Cancelled";

  return normalized
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildCompactAlertMessage(input: {
  tag: string;
  order: string;
  items: string;
  total: string;
  status: string;
}) {
  return [
    input.tag,
    `Order: ${input.order}`,
    `Items: ${input.items}`,
    `Total: ${input.total}`,
    `Status: ${input.status}`,
  ].join("\n");
}

function appendLineItemsSection(
  baseMessage: string,
  lines?: Array<{ title: string; quantity: number }>,
) {
  if (!lines || lines.length === 0) {
    return baseMessage;
  }

  const maxVisibleLines = 5;
  const visible = lines.slice(0, maxVisibleLines);
  const hiddenCount = Math.max(0, lines.length - visible.length);
  const lineSection = [
    "",
    "Line items:",
    ...visible.map((line) => `- ${line.quantity} x ${line.title}`),
    hiddenCount > 0 ? `- +${hiddenCount} more` : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Keep Telegram document caption safely under the practical limit.
  const combined = `${baseMessage}${lineSection}`;
  const maxCaptionChars = 980;
  if (combined.length <= maxCaptionChars) {
    return combined;
  }

  const clippedLines: string[] = [];
  for (const line of visible.map((entry) => `- ${entry.quantity} x ${entry.title}`)) {
    const candidate = [baseMessage, "", "Line items:", ...clippedLines, line].join("\n");
    if (candidate.length > maxCaptionChars) {
      break;
    }
    clippedLines.push(line);
  }

  return [baseMessage, "", "Line items:", ...clippedLines, "- +more"].join("\n");
}

export function buildTelegramConnectedMessage() {
  return buildCompactAlertMessage({
    tag: "CHANNEL CONNECTED",
    order: "-",
    items: "-",
    total: "-",
    status: "Telegram linked",
  });
}

export function buildTelegramConnectionExpiredMessage() {
  return buildCompactAlertMessage({
    tag: "CONNECTION EXPIRED",
    order: "-",
    items: "-",
    total: "-",
    status: "Reconnect from dashboard",
  });
}

export function buildTelegramTestPingMessage() {
  return buildCompactAlertMessage({
    tag: "CHANNEL HEALTH",
    order: "-",
    items: "-",
    total: "-",
    status: "Telegram connected",
  });
}

export function buildItemSoldMessage(input: {
  itemTitle: string;
  itemId: string;
  previousStock: number;
  currentStock: number;
  soldUnits: number;
  permalink?: string | null;
}) {
  return buildCompactAlertMessage({
    tag: "ITEM SOLD",
    order: "-",
    items: `${input.itemTitle} (${input.itemId})`,
    total: "-",
    status: `${input.soldUnits} sold; ${input.previousStock} -> ${input.currentStock}`,
  });
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

  const base = buildCompactAlertMessage({
    tag: "✅ ORDER SOLD",
    order: input.orderId,
    items: String(totalUnits),
    total: formatCurrencyCOP(input.totalAmount),
    status: formatStatusLabel(input.status),
  });

  return appendLineItemsSection(base, input.lines);
}

export function buildOrderLabelReadyMessage(input: {
  orderId: string;
  shipmentId: string;
  saleType?: "flex" | "full" | "other" | null;
  lines?: Array<{
    title: string;
    quantity: number;
  }>;
}) {
  const saleTypeLabel =
    input.saleType === "flex"
      ? "Flex"
      : input.saleType === "full"
        ? "Full"
        : input.saleType === "other"
          ? "Other"
          : "Unknown";

  const base = buildCompactAlertMessage({
    tag: "🚚 LABEL READY",
    order: input.orderId,
    items: `Shipment ${input.shipmentId}`,
    total: "-",
    status: saleTypeLabel,
  });

  return appendLineItemsSection(base, input.lines);
}

export function buildOutOfStockMessage(input: {
  itemId: string;
  itemTitle: string;
  previousStock: number;
  currentStock: number;
  source: "orders_v2" | "items";
}) {
  return buildCompactAlertMessage({
    tag: "🚨 OUT OF STOCK 🚨",
    order: "-",
    items: `${input.itemTitle} (${input.itemId})`,
    total: "-",
    status: `${input.previousStock} -> ${input.currentStock} (${input.source})`,
  });
}

export function buildLowStockMessage(input: {
  itemId: string;
  itemTitle: string;
  previousStock: number;
  currentStock: number;
  threshold: number;
  source: "orders_v2" | "items";
}) {
  return buildCompactAlertMessage({
    tag: "⚠️ LOW STOCK ⚠️ ",
    order: "-",
    items: `${input.itemTitle} (${input.itemId})`,
    total: "-",
    status: `${input.currentStock} left (thr ${input.threshold}, ${input.source})`,
  });
}
