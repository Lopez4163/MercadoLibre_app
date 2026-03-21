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

const PRIMARY_MESSAGE_CHAR_LIMIT = 980;
const FOLLOW_UP_MESSAGE_CHAR_LIMIT = 3500;

type LineItemInput = {
  title: string;
  quantity: number;
};

function buildLineItemsMessages(
  baseMessage: string,
  lines?: Array<LineItemInput>,
) {
  if (!lines || lines.length === 0) {
    return {
      primaryMessage: baseMessage,
      overflowMessages: [] as string[],
    };
  }

  const renderedLines = lines.map((line) => `- ${line.quantity} x ${line.title}`);
  const primaryPrefix = [baseMessage, "", "Line items:"].join("\n");

  const primaryLines: string[] = [];
  for (const line of renderedLines) {
    const candidate = [primaryPrefix, ...primaryLines, line].join("\n");
    if (candidate.length > PRIMARY_MESSAGE_CHAR_LIMIT) {
      break;
    }
    primaryLines.push(line);
  }

  const remainingLines = renderedLines.slice(primaryLines.length);
  const primaryMessage =
    remainingLines.length === 0
      ? [primaryPrefix, ...primaryLines].join("\n")
      : [primaryPrefix, ...primaryLines, `- +${remainingLines.length} more`].join("\n");

  if (remainingLines.length === 0) {
    return {
      primaryMessage,
      overflowMessages: [] as string[],
    };
  }

  const overflowMessages: string[] = [];
  let chunk: string[] = [];

  for (const line of remainingLines) {
    const prefix = `More line items (${overflowMessages.length + 1}):`;
    const candidate = [prefix, ...chunk, line].join("\n");
    if (candidate.length > FOLLOW_UP_MESSAGE_CHAR_LIMIT && chunk.length > 0) {
      overflowMessages.push([prefix, ...chunk].join("\n"));
      chunk = [line];
      continue;
    }
    chunk.push(line);
  }

  if (chunk.length > 0) {
    const prefix = `More line items (${overflowMessages.length + 1}):`;
    overflowMessages.push([prefix, ...chunk].join("\n"));
  }

  return {
    primaryMessage,
    overflowMessages,
  };
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

export function buildTelegramPrivateChatRequiredMessage() {
  return buildCompactAlertMessage({
    tag: "PRIVATE CHAT REQUIRED",
    order: "-",
    items: "-",
    total: "-",
    status: "Open a direct chat with the bot and run /start there",
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

  return buildLineItemsMessages(base, input.lines).primaryMessage;
}

export function buildOrderSoldMessageWithOverflow(input: {
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

  return buildLineItemsMessages(base, input.lines);
}

export function buildOrderLabelReadyMessage(input: {
  orderId: string;
  shipmentId: string;
  destinationCity?: string | null;
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

  const base = [
    "🚚 LABEL READY",
    `Order: ${input.orderId}`,
    `Shipment: ${input.shipmentId}`,
    `City: ${input.destinationCity?.trim() ? input.destinationCity.trim() : "-"}`,
    `Status: ${saleTypeLabel}`,
  ].join("\n");

  return buildLineItemsMessages(base, input.lines).primaryMessage;
}

export function buildOutOfStockMessage(input: {
  itemId: string;
  itemTitle: string;
  previousStock: number;
  currentStock: number;
  source: "orders_v2" | "items";
}) {
  return [
    "🚨 OUT OF STOCK 🚨",
    `Item #: ${input.itemId}`,
    `Item: ${input.itemTitle}`,
  ].join("\n");
}

export function buildLowStockMessage(input: {
  itemId: string;
  itemTitle: string;
  previousStock: number;
  currentStock: number;
  threshold: number;
  source: "orders_v2" | "items";
}) {
  return [
    "⚠️ LOW STOCK ⚠️",
    `Item #: ${input.itemId}`,
    `Item: ${input.itemTitle}`,
    `Change: ${input.previousStock} -> ${input.currentStock}`,
    `Now: ${input.currentStock}`,
  ].join("\n");
}
