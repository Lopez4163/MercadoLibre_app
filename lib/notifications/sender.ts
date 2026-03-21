import { prisma } from "../db/prisma";
import type { MlOrderSaleType, MlShipmentLabelDocument } from "../ml/api";
import type { TelegramInlineButton } from "../telegram/bot";
import {
  isPermanentTelegramDeliveryError,
  sendTelegramDocument,
  sendTelegramMessage,
} from "../telegram/bot";
import {
  buildLowStockMessage,
  buildOrderLabelReadyMessage,
  buildOrderSoldMessageWithOverflow,
  buildOutOfStockMessage,
} from "../telegram/messages";

type OrderSoldNotificationInput = {
  userId: string;
  orderId: string;
  status?: string;
  totalAmount?: number;
  labelDocument?: MlShipmentLabelDocument | null;
  inlineButtons?: TelegramInlineButton[];
  lines: Array<{
    itemId: string;
    title: string;
    quantity: number;
  }>;
};

async function getNotificationSettings(userId: string) {
  return prisma.notificationSettings.upsert({
    where: { userId },
    create: {
      userId,
    },
    update: {},
    select: {
      notifyEverySale: true,
      notifySoldOut: true,
      notifyLowStock: true,
      lowStockThreshold: true,
    },
  });
}

async function handleTelegramDeliveryFailure(input: {
  userId: string;
  chatId: string;
  reason: "telegram_send_failed" | "telegram_delivery_permanent_failure";
  error: unknown;
  context: Record<string, unknown>;
}) {
  console.error("telegram delivery failed", {
    userId: input.userId,
    chatId: input.chatId,
    reason: input.reason,
    ...input.context,
    error: input.error,
  });

  if (input.reason === "telegram_delivery_permanent_failure") {
    await prisma.telegramAccount
      .deleteMany({
        where: {
          userId: input.userId,
          chatId: input.chatId,
        },
      })
      .catch(() => null);
  }

  return { sent: false as const, reason: input.reason };
}

function mapTelegramDeliveryFailureReason(error: unknown) {
  if (isPermanentTelegramDeliveryError(error)) {
    return "telegram_delivery_permanent_failure" as const;
  }

  return "telegram_send_failed" as const;
}

export async function sendOrderSoldNotification(input: OrderSoldNotificationInput) {
  const settings = await getNotificationSettings(input.userId);
  if (!settings.notifyEverySale) {
    return { sent: false as const, reason: "notify_every_sale_disabled" as const };
  }

  const account = await prisma.telegramAccount.findUnique({
    where: { userId: input.userId },
    select: { chatId: true },
  });

  if (!account?.chatId) {
    return { sent: false as const, reason: "telegram_not_connected" as const };
  }

  const messageContent = buildOrderSoldMessageWithOverflow({
    orderId: input.orderId,
    status: input.status,
    totalAmount: input.totalAmount,
    lines: input.lines,
  });

  if (input.labelDocument) {
    try {
      await sendTelegramDocument(
        account.chatId,
        {
          data: input.labelDocument.data,
          fileName: input.labelDocument.fileName,
          contentType: input.labelDocument.contentType,
        },
        { caption: messageContent.primaryMessage },
      );

      for (const overflowMessage of messageContent.overflowMessages) {
        await sendTelegramMessage(account.chatId, overflowMessage);
      }
      return { sent: true as const };
    } catch (error) {
      const reason = mapTelegramDeliveryFailureReason(error);
      if (reason === "telegram_delivery_permanent_failure") {
        return handleTelegramDeliveryFailure({
          userId: input.userId,
          chatId: account.chatId,
          reason,
          error,
          context: {
            source: "order_sold_document",
            orderId: input.orderId,
          },
        });
      }

      console.error("telegram label document send failed for order notification", {
        userId: input.userId,
        orderId: input.orderId,
        error,
      });
    }
  }

  try {
    await sendTelegramMessage(account.chatId, messageContent.primaryMessage, {
      inlineButtons: input.inlineButtons,
    });

    for (const overflowMessage of messageContent.overflowMessages) {
      await sendTelegramMessage(account.chatId, overflowMessage);
    }

    return { sent: true as const };
  } catch (error) {
    return handleTelegramDeliveryFailure({
      userId: input.userId,
      chatId: account.chatId,
      reason: mapTelegramDeliveryFailureReason(error),
      error,
      context: {
        source: "order_sold_message",
        orderId: input.orderId,
      },
    });
  }
}

type OutOfStockNotificationInput = {
  userId: string;
  itemId: string;
  itemTitle: string;
  previousStock: number;
  currentStock: number;
  source: "orders_v2" | "items";
};

type OrderLabelReadyNotificationInput = {
  userId: string;
  orderId: string;
  shipmentId: string;
  destinationCity?: string | null;
  saleType?: MlOrderSaleType | null;
  lines?: Array<{
    title: string;
    quantity: number;
  }>;
  labelDocument?: MlShipmentLabelDocument | null;
  inlineButtons?: TelegramInlineButton[];
};

export async function sendOutOfStockNotification(input: OutOfStockNotificationInput) {
  const settings = await getNotificationSettings(input.userId);
  if (!settings.notifySoldOut) {
    return { sent: false as const, reason: "notify_sold_out_disabled" as const };
  }

  const account = await prisma.telegramAccount.findUnique({
    where: { userId: input.userId },
    select: { chatId: true },
  });

  if (!account?.chatId) {
    return { sent: false as const, reason: "telegram_not_connected" as const };
  }

  const message = buildOutOfStockMessage({
    itemId: input.itemId,
    itemTitle: input.itemTitle,
    previousStock: input.previousStock,
    currentStock: input.currentStock,
    source: input.source,
  });

  try {
    await sendTelegramMessage(account.chatId, message);
    return { sent: true as const };
  } catch (error) {
    return handleTelegramDeliveryFailure({
      userId: input.userId,
      chatId: account.chatId,
      reason: mapTelegramDeliveryFailureReason(error),
      error,
      context: {
        source: "out_of_stock",
        itemId: input.itemId,
      },
    });
  }
}

export async function sendOrderLabelReadyNotification(input: OrderLabelReadyNotificationInput) {
  const settings = await getNotificationSettings(input.userId);
  if (!settings.notifyEverySale) {
    return { sent: false as const, reason: "notify_every_sale_disabled" as const };
  }

  const account = await prisma.telegramAccount.findUnique({
    where: { userId: input.userId },
    select: { chatId: true },
  });

  if (!account?.chatId) {
    return { sent: false as const, reason: "telegram_not_connected" as const };
  }

  const message = buildOrderLabelReadyMessage({
    orderId: input.orderId,
    shipmentId: input.shipmentId,
    destinationCity: input.destinationCity,
    saleType: input.saleType,
    lines: input.lines,
  });

  if (input.labelDocument) {
    try {
      await sendTelegramDocument(
        account.chatId,
        {
          data: input.labelDocument.data,
          fileName: input.labelDocument.fileName,
          contentType: input.labelDocument.contentType,
        },
        { caption: message },
      );
      return { sent: true as const };
    } catch (error) {
      const reason = mapTelegramDeliveryFailureReason(error);
      if (reason === "telegram_delivery_permanent_failure") {
        return handleTelegramDeliveryFailure({
          userId: input.userId,
          chatId: account.chatId,
          reason,
          error,
          context: {
            source: "label_ready_document",
            orderId: input.orderId,
            shipmentId: input.shipmentId,
          },
        });
      }

      console.error("telegram label document send failed for label-ready notification", {
        userId: input.userId,
        orderId: input.orderId,
        shipmentId: input.shipmentId,
        error,
      });
    }
  }

  try {
    await sendTelegramMessage(account.chatId, message, {
      inlineButtons: input.inlineButtons,
    });
    return { sent: true as const };
  } catch (error) {
    return handleTelegramDeliveryFailure({
      userId: input.userId,
      chatId: account.chatId,
      reason: mapTelegramDeliveryFailureReason(error),
      error,
      context: {
        source: "label_ready_message",
        orderId: input.orderId,
        shipmentId: input.shipmentId,
      },
    });
  }
}

type LowStockNotificationInput = {
  userId: string;
  itemId: string;
  itemTitle: string;
  previousStock: number;
  currentStock: number;
  threshold: number;
  source: "orders_v2" | "items";
};

export async function sendLowStockNotification(input: LowStockNotificationInput) {
  const settings = await getNotificationSettings(input.userId);
  if (!settings.notifyLowStock) {
    return { sent: false as const, reason: "notify_low_stock_disabled" as const };
  }

  const account = await prisma.telegramAccount.findUnique({
    where: { userId: input.userId },
    select: { chatId: true },
  });

  if (!account?.chatId) {
    return { sent: false as const, reason: "telegram_not_connected" as const };
  }

  const message = buildLowStockMessage({
    itemId: input.itemId,
    itemTitle: input.itemTitle,
    previousStock: input.previousStock,
    currentStock: input.currentStock,
    threshold: input.threshold,
    source: input.source,
  });

  try {
    await sendTelegramMessage(account.chatId, message);
    return { sent: true as const };
  } catch (error) {
    return handleTelegramDeliveryFailure({
      userId: input.userId,
      chatId: account.chatId,
      reason: mapTelegramDeliveryFailureReason(error),
      error,
      context: {
        source: "low_stock",
        itemId: input.itemId,
      },
    });
  }
}
