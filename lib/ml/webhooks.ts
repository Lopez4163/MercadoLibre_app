import { createHash } from "crypto";
import { prisma } from "../db/prisma";
import { sendOrderSoldNotification, sendOutOfStockNotification } from "../notifications/sender";
import { getItemById, getOrderById } from "./api";

type MlWebhookBody = {
  user_id?: string | number;
  resource?: string;
  topic?: string;
  action?: string;
  sent?: string;
  id?: string | number;
};

type ProcessMlWebhookInput = {
  body?: unknown;
  query: URLSearchParams;
};

function asString(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function resolveUserId(body: MlWebhookBody | null | undefined, query: URLSearchParams) {
  return asString(body?.user_id) ?? query.get("user_id") ?? query.get("seller_id");
}

function resolveTopic(body: MlWebhookBody | null | undefined, query: URLSearchParams) {
  return asString(body?.topic) ?? query.get("topic") ?? "";
}

function resolveAction(body: MlWebhookBody | null | undefined, query: URLSearchParams) {
  return asString(body?.action) ?? query.get("action") ?? "";
}

function resolveResource(body: MlWebhookBody | null | undefined, query: URLSearchParams) {
  return asString(body?.resource) ?? query.get("resource") ?? "";
}

function resolveEventKey(body: MlWebhookBody | null | undefined, query: URLSearchParams) {
  const eventId = asString(body?.id) ?? query.get("id");
  const sent = asString(body?.sent) ?? query.get("sent") ?? "";
  const resource = resolveResource(body, query);
  const action = resolveAction(body, query);
  const topic = resolveTopic(body, query);
  const userId = resolveUserId(body, query) ?? "";

  if (eventId) {
    return `ml:${eventId}`;
  }

  const raw = `${userId}|${topic}|${action}|${resource}|${sent}`;
  return `mlhash:${createHash("sha256").update(raw).digest("hex")}`;
}

function extractItemId(resource: string) {
  const match = resource.match(/\/items\/([^/?]+)/i);
  return match?.[1] ?? null;
}

function extractOrderId(resource: string) {
  const match = resource.match(/\/orders\/([^/?]+)/i);
  return match?.[1] ?? null;
}

function isOrderEvent(topic: string, resource: string, action: string) {
  const combined = `${topic}|${resource}|${action}`.toLowerCase();
  return combined.includes("orders_v2") || combined.includes("/orders/");
}

function isItemSnapshotEvent(topic: string, resource: string, action: string) {
  const combined = `${topic}|${resource}|${action}`.toLowerCase();
  return combined.includes("item") || combined.includes("/items/") || combined.includes("fbm_stock_operations");
}

async function handleOrderEvent(options: {
  userId: string;
  accessToken: string;
  orderId: string;
  eventKey: string;
}) {
  const { userId, accessToken, orderId, eventKey } = options;

  const order = await getOrderById({
    accessToken,
    orderId,
  }).catch(() => null);

  if (!order || order.lines.length === 0) {
    console.log("[ML webhook] order fetch failed or empty", {
      eventKey,
      orderId,
    });
    return { processed: false as const, reason: "order_fetch_failed_or_empty" as const };
  }

  const orderNotifyResult = await sendOrderSoldNotification({
    userId,
    orderId: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
    lines: order.lines,
  }).catch(() => ({ sent: false as const, reason: "telegram_send_failed" as const }));

  const lineItemIds = order.lines.map((line) => line.itemId);
  const existingSnapshots = await prisma.item.findMany({
    where: {
      userId,
      mlItemId: { in: lineItemIds },
    },
    select: {
      mlItemId: true,
      stock: true,
      threshold: true,
      name: true,
    },
  });

  const snapshotMap = new Map(existingSnapshots.map((item) => [item.mlItemId, item]));

  for (const line of order.lines) {
    const snapshot = snapshotMap.get(line.itemId);

    let previousStock: number;
    let currentStock: number;

    if (snapshot) {
      previousStock = snapshot.stock;
      currentStock = Math.max(previousStock - line.quantity, 0);
    } else {
      // No local snapshot yet. Pull one item once and infer pre-order stock.
      const liveItem = await getItemById({
        accessToken,
        itemId: line.itemId,
      }).catch(() => null);

      if (!liveItem) {
        continue;
      }

      currentStock = liveItem.available_quantity;
      previousStock = currentStock + line.quantity;
    }

    await prisma.item.upsert({
      where: {
        userId_mlItemId: {
          userId,
          mlItemId: line.itemId,
        },
      },
      create: {
        userId,
        mlItemId: line.itemId,
        name: line.title,
        stock: currentStock,
        threshold: 5,
      },
      update: {
        name: line.title,
        stock: currentStock,
      },
    });

    if (previousStock > 0 && currentStock === 0) {
      const outNotifyResult = await sendOutOfStockNotification({
        userId,
        itemId: line.itemId,
        itemTitle: line.title,
        previousStock,
        currentStock,
        source: "orders_v2",
      }).catch(() => ({ sent: false as const, reason: "telegram_send_failed" as const }));

      console.log("[ML webhook] out-of-stock transition from order", {
        eventKey,
        orderId: order.id,
        itemId: line.itemId,
        previousStock,
        currentStock,
        telegramNotified: outNotifyResult.sent,
      });
    }
  }

  console.log("[ML webhook] order processed", {
    eventKey,
    orderId: order.id,
    lineCount: order.lines.length,
    telegramNotified: orderNotifyResult.sent,
    notifyReason: "reason" in orderNotifyResult ? orderNotifyResult.reason : undefined,
  });

  return {
    processed: true as const,
    orderId: order.id,
    notified: orderNotifyResult.sent,
  };
}

async function handleItemSnapshotEvent(options: {
  userId: string;
  mlUserId: string;
  accessToken: string;
  resource: string;
  eventKey: string;
}) {
  const { userId, mlUserId, accessToken, resource, eventKey } = options;

  const itemId = extractItemId(resource);
  if (!itemId) {
    console.log("[ML webhook] snapshot topic without direct item id", {
      eventKey,
      resource,
      note: "fbm_stock_operations currently logged-only until operation-resource resolver is added",
    });

    return {
      processed: false as const,
      reason: "missing_item_id_in_resource" as const,
    };
  }

  const item = await getItemById({
    accessToken,
    itemId,
  }).catch(() => null);

  if (!item) {
    console.log("[ML webhook] item fetch failed", {
      eventKey,
      itemId,
      mlUserId,
    });
    return { processed: false as const, reason: "item_fetch_failed" as const };
  }

  const existing = await prisma.item.findUnique({
    where: {
      userId_mlItemId: {
        userId,
        mlItemId: item.id,
      },
    },
    select: {
      stock: true,
      threshold: true,
    },
  });

  const previousStock = existing?.stock ?? item.available_quantity;
  const currentStock = item.available_quantity;

  await prisma.item.upsert({
    where: {
      userId_mlItemId: {
        userId,
        mlItemId: item.id,
      },
    },
    create: {
      userId,
      mlItemId: item.id,
      name: item.title,
      stock: currentStock,
      threshold: 5,
    },
    update: {
      name: item.title,
      stock: currentStock,
    },
  });

  if (previousStock > 0 && currentStock === 0) {
    const notifyResult = await sendOutOfStockNotification({
      userId,
      itemId: item.id,
      itemTitle: item.title,
      previousStock,
      currentStock,
      source: "items",
    }).catch(() => ({ sent: false as const, reason: "telegram_send_failed" as const }));

    console.log("[ML webhook] out-of-stock transition from stock snapshot", {
      eventKey,
      itemId: item.id,
      previousStock,
      currentStock,
      telegramNotified: notifyResult.sent,
      notifyReason: "reason" in notifyResult ? notifyResult.reason : undefined,
    });

    return {
      processed: true as const,
      soldUnits: Math.max(previousStock - currentStock, 0),
      notified: notifyResult.sent,
    };
  }

  console.log("[ML webhook] snapshot updated", {
    eventKey,
    itemId: item.id,
    previousStock,
    currentStock,
  });

  return {
    processed: true as const,
    soldUnits: Math.max(previousStock - currentStock, 0),
    notified: false as const,
  };
}

export async function processMercadoLibreWebhook(input: ProcessMlWebhookInput) {
  const body = typeof input.body === "object" && input.body !== null ? (input.body as MlWebhookBody) : null;
  const mlUserId = resolveUserId(body, input.query);
  const topic = resolveTopic(body, input.query);
  const action = resolveAction(body, input.query);
  const resource = resolveResource(body, input.query);

  console.log("[ML webhook] received", {
    mlUserId,
    topic,
    action,
    resource,
  });

  const matchesOrder = isOrderEvent(topic, resource, action);
  const matchesItemSnapshot = isItemSnapshotEvent(topic, resource, action);

  if (!mlUserId || !resource || (!matchesOrder && !matchesItemSnapshot)) {
    console.log("[ML webhook] ignored", {
      reason: "non_supported_topic_or_missing_fields",
      mlUserId,
      topic,
      action,
      resource,
    });
    return { processed: false as const, reason: "ignored" as const };
  }

  const orderIdForDedupe = matchesOrder ? extractOrderId(resource) : null;
  const eventKey = orderIdForDedupe
    ? `orders_v2:${mlUserId}:${orderIdForDedupe}`
    : resolveEventKey(body, input.query);

  const createdEvent = await prisma.mlWebhookEvent
    .create({
      data: {
        eventKey,
        mlUserId,
        topic,
        action,
        resource,
      },
      select: { id: true },
    })
    .catch(() => null);

  if (!createdEvent) {
    console.log("[ML webhook] duplicate", {
      eventKey,
      mlUserId,
      topic,
      action,
      resource,
    });
    return { processed: false as const, reason: "duplicate" as const };
  }

  const user = await prisma.user.findUnique({
    where: { mlUserId },
    select: {
      id: true,
      accessToken: true,
    },
  });

  if (!user) {
    console.log("[ML webhook] unknown user", {
      eventKey,
      mlUserId,
    });
    return { processed: false as const, reason: "unknown_user" as const };
  }

  await prisma.mlWebhookEvent.update({
    where: { id: createdEvent.id },
    data: { userId: user.id },
  });

  if (matchesOrder) {
    const orderId = extractOrderId(resource);
    if (!orderId) {
      console.log("[ML webhook] missing order id", {
        eventKey,
        resource,
      });
      return { processed: false as const, reason: "missing_order_id" as const };
    }

    return handleOrderEvent({
      userId: user.id,
      accessToken: user.accessToken,
      orderId,
      eventKey,
    });
  }

  return handleItemSnapshotEvent({
    userId: user.id,
    mlUserId,
    accessToken: user.accessToken,
    resource,
    eventKey,
  });
}
