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

  const formatCurrencyCOP = (amount?: number) => {
    if (!Number.isFinite(amount)) return null;

    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount as number);
  };

  const capitalize = (value?: string) => {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  const statusLabel = (status?: string) => {
    if (!status) return null;

    const normalized = status.toLowerCase();

    if (normalized === "paid") return "📌 Estado: Pagado";
    if (normalized === "pending") return "📌 Estado: Pendiente";
    if (normalized === "cancelled") return "📌 Estado: Cancelado";

    return `📌 Estado: ${capitalize(status)}`;
  };

  const itemLines = input.lines
    .slice(0, 3)
    .map((line) => `• ${line.quantity} x ${line.title}`);

  const extraItems =
    input.lines.length > 3
      ? `+${input.lines.length - 3} producto${input.lines.length - 3 === 1 ? "" : "s"} más`
      : null;

  const formattedTotal = formatCurrencyCOP(input.totalAmount);

  const message = [
    "✅ Nueva orden",
    "",
    `🧾 Orden: ${input.orderId}`,
    `📦 Unidades: ${totalUnits}`,
    formattedTotal ? `💰 Total: ${formattedTotal}` : null,
    statusLabel(input.status),
    itemLines.length > 0 ? "" : null,
    itemLines.length > 0 ? "🛍 Productos" : null,
    ...itemLines,
    extraItems,
  ].filter(Boolean);

  return message.join("\n");
}

export function buildOrderLabelReadyMessage(input: {
  orderId: string;
  shipmentId: string;
  saleType?: "flex" | "full" | "other" | null;
}) {
  const saleTypeLabel =
    input.saleType === "flex"
      ? "🚚 Tipo de venta: Flex"
      : input.saleType === "full"
        ? "🏬 Tipo de venta: Full"
        : input.saleType === "other"
          ? "🚛 Tipo de venta: Otra"
          : null;

  return [
    "📄 Label ready",
    "",
    `🧾 Orden: ${input.orderId}`,
    `📦 Envio: ${input.shipmentId}`,
    saleTypeLabel,
    "La guia ya esta disponible para descargar.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildOutOfStockMessage(input: {
  itemId: string;
  itemTitle: string;
  previousStock: number;
  currentStock: number;
  source: "orders_v2" | "items";
}) {
  return [
    "🚫 Out of Stock",
    input.itemTitle,
    `📦 Item: ${input.itemId}`,
    `📉 Stock: ${input.previousStock} -> ${input.currentStock}`,
    `Source: ${input.source}`,
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
    "⚠️ Low stock",
    input.itemTitle,
    `📦 Item: ${input.itemId}`,
    `📉 Stock: ${input.previousStock} -> ${input.currentStock}`,
    `🎯 Threshold: ${input.threshold}`,
    `Source: ${input.source}`,
  ].join("\n");
}
