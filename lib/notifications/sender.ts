import { prisma } from "../db/prisma";
import type { MlOrderSaleType } from "../ml/api";
import type { TelegramInlineButton } from "../telegram/bot";
import { sendTelegramMessage } from "../telegram/bot";
import {
  buildLowStockMessage,
  buildOrderLabelReadyMessage,
  buildOrderSoldMessage,
  buildOutOfStockMessage,
} from "../telegram/messages";

type OrderSoldNotificationInput = {
  userId: string;
  orderId: string;
  status?: string;
  totalAmount?: number;
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

  const message = buildOrderSoldMessage({
    orderId: input.orderId,
    status: input.status,
    totalAmount: input.totalAmount,
    lines: input.lines,
  });

  await sendTelegramMessage(account.chatId, message, {
    inlineButtons: input.inlineButtons,
  });
  return { sent: true as const };
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
  saleType?: MlOrderSaleType | null;
  inlineButtons: TelegramInlineButton[];
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

  await sendTelegramMessage(account.chatId, message);
  return { sent: true as const };
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
    saleType: input.saleType,
  });

  await sendTelegramMessage(account.chatId, message, {
    inlineButtons: input.inlineButtons,
  });
  return { sent: true as const };
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

  await sendTelegramMessage(account.chatId, message);
  return { sent: true as const };
}
