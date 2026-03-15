import { getAppBaseUrl } from "../app/base-url";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { createOrderLabelToken } from "../labels/token";
import { prisma } from "../db/prisma";
import { isBillingStatusActive } from "../billing/entitlements";
import {
  sendLowStockNotification,
  sendOrderLabelReadyNotification,
  sendOrderSoldNotification,
  sendOutOfStockNotification,
} from "../notifications/sender";
import {
  getItemById,
  getOrderById,
  getPrimaryOrderShipment,
  getShipmentById,
  getShipmentLabelDocument,
  type MlOrderSnapshot,
  type MlOrderSaleType,
} from "./api";
import { withUserMlAccessToken } from "./tokens";

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

function extractShipmentId(resource: string) {
  const match = resource.match(/\/shipments\/([^/?]+)/i);
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

function isShipmentEvent(topic: string, resource: string, action: string) {
  const combined = `${topic}|${resource}|${action}`.toLowerCase();
  return combined.includes("shipment") || combined.includes("/shipments/");
}

function buildOrderLabelButtonUrl(input: {
  userId: string;
  orderId: string;
  shipmentId: string;
}) {
  const baseUrl = getAppBaseUrl();
  const labelUrl = new URL(`/api/orders/${input.orderId}/label`, baseUrl);
  labelUrl.searchParams.set(
    "token",
    createOrderLabelToken({
      userId: input.userId,
      orderId: input.orderId,
      shipmentId: input.shipmentId,
    }),
  );
  return labelUrl.toString();
}

function mapShipmentSaleType(logisticType: string | null | undefined): MlOrderSaleType | null {
  if (!logisticType) {
    return null;
  }

  const normalized = logisticType.toLowerCase();

  if (normalized === "self_service") {
    return "flex";
  }

  if (normalized === "fulfillment") {
    return "full";
  }

  return "other";
}

function isLabelNotReadyMlError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("not_printable_status") ||
    message.includes("invalid_shipment_ff_public") ||
    message.includes(" 404") ||
    message.includes("not found")
  );
}

async function getNotificationSettings(userId: string) {
  return prisma.notificationSettings.upsert({
    where: { userId },
    create: {
      userId,
    },
    update: {},
    select: {
      notifyLowStock: true,
      lowStockThreshold: true,
    },
  });
}

function getOrderExpiryDate(now: Date) {
  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
}

async function ensureOrderRecord(options: { userId: string; mlOrderId: string }) {
  const now = new Date();
  return prisma.order.upsert({
    where: {
      userId_mlOrderId: {
        userId: options.userId,
        mlOrderId: options.mlOrderId,
      },
    },
    create: {
      userId: options.userId,
      mlOrderId: options.mlOrderId,
      status: "unknown",
      lastSeenAt: now,
      expiresAt: getOrderExpiryDate(now),
    },
    update: {
      lastSeenAt: now,
      expiresAt: getOrderExpiryDate(now),
    },
    select: {
      id: true,
    },
  });
}

async function persistOrderSnapshot(options: {
  userId: string;
  order: MlOrderSnapshot;
  saleType: MlOrderSaleType | null;
}) {
  const { userId, order, saleType } = options;
  const persistedOrder = await ensureOrderRecord({
    userId,
    mlOrderId: order.id,
  });

  await prisma.order.update({
    where: {
      id: persistedOrder.id,
    },
    data: {
      status: order.status ?? "unknown",
      totalAmount: order.totalAmount,
      saleType,
      createdAtMl: null,
      updatedAtMl: null,
    },
  });

  await prisma.orderLine.deleteMany({
    where: {
      orderId: persistedOrder.id,
    },
  });

  if (order.lines.length > 0) {
    await prisma.orderLine.createMany({
      data: order.lines.map((line) => ({
        orderId: persistedOrder.id,
        mlItemId: line.itemId,
        title: line.title,
        quantity: line.quantity,
        unitPrice: null,
      })),
    });
  }

  return persistedOrder;
}

async function logOrderNotification(options: {
  userId: string;
  mlOrderId: string;
  eventType: string;
  status: string;
  reason?: string;
  payload?: Record<string, unknown>;
}) {
  const orderRecord = await ensureOrderRecord({
    userId: options.userId,
    mlOrderId: options.mlOrderId,
  });

  const payloadValue = options.payload
    ? (JSON.parse(JSON.stringify(options.payload)) as Prisma.InputJsonValue)
    : Prisma.JsonNull;

  await prisma.orderNotificationLog.create({
    data: {
      orderId: orderRecord.id,
      channel: "telegram",
      eventType: options.eventType,
      status: options.status,
      reason: options.reason ?? null,
      payload: payloadValue,
    },
  });
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

  let shipmentId: string | null = null;
  let saleType: MlOrderSaleType | null = null;
  let labelDocument: Awaited<ReturnType<typeof getShipmentLabelDocument>> | null = null;
  let labelButtonUrl: string | null = null;
  let labelButtonSkippedReason = "not_attempted";

  try {
    const shipment = await getPrimaryOrderShipment({
      accessToken,
      orderId: order.id,
    });

    shipmentId = shipment?.id ?? null;
    saleType = mapShipmentSaleType(shipment?.logisticType);

    if (!shipmentId) {
      labelButtonSkippedReason = "no_shipment";
    } else {
      labelButtonUrl = buildOrderLabelButtonUrl({
        userId,
        orderId: order.id,
        shipmentId,
      });
      labelButtonSkippedReason = "fallback_attached";

      try {
        labelDocument = await getShipmentLabelDocument({
          accessToken,
          shipmentId,
        });
      } catch (error) {
        if (isLabelNotReadyMlError(error)) {
          labelButtonSkippedReason = "label_not_ready_document_unavailable";
        } else {
          labelButtonSkippedReason = "document_fetch_failed_fallback_to_link";
        }
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("APP_BASE_URL")) {
      labelButtonSkippedReason = "missing_base_url";
    } else {
      labelButtonSkippedReason = "label_link_setup_failed";
    }

    console.error("[ML webhook] label link setup failed", {
      eventKey,
      orderId: order.id,
      labelButtonSkippedReason,
      error,
    });
  }

  await persistOrderSnapshot({
    userId,
    order,
    saleType,
  });

  console.log("[ML webhook] order shipment lookup", {
    eventKey,
    orderId: order.id,
    shipmentId,
    hasLabelDocument: Boolean(labelDocument),
    hasLabelButton: Boolean(labelButtonUrl),
    labelButtonSkippedReason,
  });

  const orderNotifyResult = await sendOrderSoldNotification({
    userId,
    orderId: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
    labelDocument,
    inlineButtons: labelButtonUrl
      ? [
          {
            text: "Download Label",
            url: labelButtonUrl,
          },
        ]
      : undefined,
    lines: order.lines,
  }).catch(() => ({ sent: false as const, reason: "telegram_send_failed" as const }));

  await logOrderNotification({
    userId,
    mlOrderId: order.id,
    eventType: "order_sold",
    status: orderNotifyResult.sent ? "sent" : "failed",
    reason: "reason" in orderNotifyResult ? orderNotifyResult.reason : undefined,
    payload: {
      eventKey,
      shipmentId,
      hasLabelDocument: Boolean(labelDocument),
      labelButtonUrl,
      hasLabelButton: Boolean(labelButtonUrl),
      labelButtonSkippedReason,
    },
  });

  const lineItemIds = order.lines.map((line) => line.itemId);
  const notificationSettings = await getNotificationSettings(userId);
  const threshold = notificationSettings.lowStockThreshold;

  const existingSnapshots = await prisma.item.findMany({
    where: {
      userId,
      mlItemId: { in: lineItemIds },
    },
    select: {
      mlItemId: true,
      stock: true,
      lowStockAlertedAt: true,
      name: true,
    },
  });

  const snapshotMap = new Map(existingSnapshots.map((item) => [item.mlItemId, item]));

  for (const line of order.lines) {
    const snapshot = snapshotMap.get(line.itemId);
    const liveItem = await getItemById({
      accessToken,
      itemId: line.itemId,
    }).catch(() => null);

    let previousStock: number;
    let currentStock: number;

    if (snapshot && liveItem) {
      // Use live stock for post-order state to avoid false sold-out flags from stale local snapshots.
      currentStock = liveItem.available_quantity;
      previousStock = Math.max(snapshot.stock, currentStock + line.quantity);
    } else if (snapshot) {
      previousStock = snapshot.stock;
      currentStock = Math.max(previousStock - line.quantity, 0);
    } else if (liveItem) {
      currentStock = liveItem.available_quantity;
      previousStock = currentStock + line.quantity;
    } else {
      continue;
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
        threshold,
        lowStockAlertedAt: currentStock > threshold ? null : snapshot?.lowStockAlertedAt ?? null,
      },
      update: {
        name: line.title,
        stock: currentStock,
        threshold,
        lowStockAlertedAt: currentStock > threshold ? null : snapshot?.lowStockAlertedAt ?? null,
      },
    });

    const crossedIntoLowStock = previousStock > threshold && currentStock <= threshold && currentStock > 0;
    if (crossedIntoLowStock && !snapshot?.lowStockAlertedAt) {
      const lowStockNotifyResult = await sendLowStockNotification({
        userId,
        itemId: line.itemId,
        itemTitle: line.title,
        previousStock,
        currentStock,
        threshold,
        source: "orders_v2",
      }).catch(() => ({ sent: false as const, reason: "telegram_send_failed" as const }));

      if (lowStockNotifyResult.sent) {
        await prisma.item.update({
          where: {
            userId_mlItemId: {
              userId,
              mlItemId: line.itemId,
            },
          },
          data: {
            lowStockAlertedAt: new Date(),
          },
        });
      }

      console.log("[ML webhook] low-stock transition from order", {
        eventKey,
        orderId: order.id,
        itemId: line.itemId,
        previousStock,
        currentStock,
        threshold,
        telegramNotified: lowStockNotifyResult.sent,
        notifyReason: "reason" in lowStockNotifyResult ? lowStockNotifyResult.reason : undefined,
      });
    }

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

async function handleShipmentEvent(options: {
  userId: string;
  mlUserId: string;
  accessToken: string;
  resource: string;
  eventKey: string;
}) {
  const { userId, mlUserId, accessToken, resource, eventKey } = options;

  const shipmentId = extractShipmentId(resource);
  if (!shipmentId) {
    console.log("[ML webhook] missing shipment id", {
      eventKey,
      resource,
    });
    return { processed: false as const, reason: "missing_shipment_id" as const };
  }

  const shipment = await getShipmentById({
    accessToken,
    shipmentId,
  }).catch(() => null);

  const orderId = shipment?.orderId ?? null;
  const saleType = mapShipmentSaleType(shipment?.logisticType);
  if (!orderId) {
    console.log("[ML webhook] shipment without order context", {
      eventKey,
      shipmentId,
    });
    return { processed: false as const, reason: "shipment_without_order" as const };
  }

  try {
    const labelDocument = await getShipmentLabelDocument({
      accessToken,
      shipmentId,
    });

    const labelNotificationKey = `shipment_label:${mlUserId}:${shipmentId}`;
    const createdLabelEvent = await prisma.mlWebhookEvent
      .create({
        data: {
          eventKey: labelNotificationKey,
          userId,
          mlUserId,
          topic: "shipment_label_ready",
          action: "notify",
          resource: `/shipments/${shipmentId}`,
        },
        select: { id: true },
      })
      .catch(() => null);

    if (!createdLabelEvent) {
      console.log("[ML webhook] shipment label duplicate", {
        eventKey,
        shipmentId,
        orderId,
        labelNotificationKey,
      });
      return { processed: false as const, reason: "shipment_label_duplicate" as const };
    }

    const labelButtonUrl = buildOrderLabelButtonUrl({
      userId,
      orderId,
      shipmentId,
    });
    const orderLineItems =
      (
        await prisma.order.findUnique({
          where: {
            userId_mlOrderId: {
              userId,
              mlOrderId: orderId,
            },
          },
          select: {
            lines: {
              select: {
                title: true,
                quantity: true,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        })
      )?.lines ?? [];

    const notifyResult = await sendOrderLabelReadyNotification({
      userId,
      orderId,
      shipmentId,
      saleType,
      lines: orderLineItems,
      labelDocument,
      inlineButtons: [
        {
          text: "Download Label",
          url: labelButtonUrl,
        },
      ],
    }).catch(() => ({ sent: false as const, reason: "telegram_send_failed" as const }));

    await logOrderNotification({
      userId,
      mlOrderId: orderId,
      eventType: "label_ready",
      status: notifyResult.sent ? "sent" : "failed",
      reason: "reason" in notifyResult ? notifyResult.reason : undefined,
      payload: {
        eventKey,
        shipmentId,
        saleType,
        labelButtonUrl,
      },
    });

    console.log("[ML webhook] shipment label notification", {
      eventKey,
      shipmentId,
      orderId,
      saleType,
      telegramNotified: notifyResult.sent,
      notifyReason: "reason" in notifyResult ? notifyResult.reason : undefined,
    });

    return {
      processed: true as const,
      orderId,
      shipmentId,
      notified: notifyResult.sent,
    };
  } catch (error) {
    if (isLabelNotReadyMlError(error)) {
      console.log("[ML webhook] shipment label not ready", {
        eventKey,
        shipmentId,
        orderId,
      });

      return {
        processed: false as const,
        reason: "shipment_label_not_ready" as const,
      };
    }

    console.error("[ML webhook] shipment label setup failed", {
      eventKey,
      shipmentId,
      orderId,
      error,
    });

    return {
      processed: false as const,
      reason: "shipment_label_setup_failed" as const,
    };
  }
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

  const notificationSettings = await getNotificationSettings(userId);
  const threshold = notificationSettings.lowStockThreshold;

  const existing = await prisma.item.findUnique({
    where: {
      userId_mlItemId: {
        userId,
        mlItemId: item.id,
      },
    },
    select: {
      stock: true,
      lowStockAlertedAt: true,
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
      threshold,
      lowStockAlertedAt: currentStock > threshold ? null : existing?.lowStockAlertedAt ?? null,
    },
    update: {
      name: item.title,
      stock: currentStock,
      threshold,
      lowStockAlertedAt: currentStock > threshold ? null : existing?.lowStockAlertedAt ?? null,
    },
  });

  const crossedIntoLowStock = previousStock > threshold && currentStock <= threshold && currentStock > 0;
  if (crossedIntoLowStock && !existing?.lowStockAlertedAt) {
    const lowStockNotifyResult = await sendLowStockNotification({
      userId,
      itemId: item.id,
      itemTitle: item.title,
      previousStock,
      currentStock,
      threshold,
      source: "items",
    }).catch(() => ({ sent: false as const, reason: "telegram_send_failed" as const }));

    if (lowStockNotifyResult.sent) {
      await prisma.item.update({
        where: {
          userId_mlItemId: {
            userId,
            mlItemId: item.id,
          },
        },
        data: {
          lowStockAlertedAt: new Date(),
        },
      });
    }

    console.log("[ML webhook] low-stock transition from stock snapshot", {
      eventKey,
      itemId: item.id,
      previousStock,
      currentStock,
      threshold,
      telegramNotified: lowStockNotifyResult.sent,
      notifyReason: "reason" in lowStockNotifyResult ? lowStockNotifyResult.reason : undefined,
    });
  }

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
  const matchesShipment = isShipmentEvent(topic, resource, action);

  if (!mlUserId || !resource || (!matchesOrder && !matchesItemSnapshot && !matchesShipment)) {
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
      refreshToken: true,
      tokenExpiresAt: true,
      billingSubscription: {
        select: {
          status: true,
        },
      },
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

  if (!isBillingStatusActive(user.billingSubscription?.status)) {
    console.log("[ML webhook] skipped for inactive billing", {
      eventKey,
      userId: user.id,
      status: user.billingSubscription?.status ?? null,
    });
    return { processed: false as const, reason: "billing_inactive" as const };
  }

  if (!user.accessToken || !user.refreshToken) {
    console.log("[ML webhook] skipped for disconnected ML credentials", {
      eventKey,
      userId: user.id,
    });
    return { processed: false as const, reason: "ml_disconnected" as const };
  }

  return withUserMlAccessToken(user, async (accessToken) => {
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
        accessToken,
        orderId,
        eventKey,
      });
    }

    if (matchesShipment) {
      return handleShipmentEvent({
        userId: user.id,
        mlUserId,
        accessToken,
        resource,
        eventKey,
      });
    }

    return handleItemSnapshotEvent({
      userId: user.id,
      mlUserId,
      accessToken,
      resource,
      eventKey,
    });
  });
}
