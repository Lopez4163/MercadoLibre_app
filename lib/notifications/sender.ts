import { prisma } from "../db/prisma";
import { sendTelegramMessage } from "../telegram/bot";
import { buildOrderSoldMessage, buildOutOfStockMessage } from "../telegram/messages";

type OrderSoldNotificationInput = {
  userId: string;
  orderId: string;
  status?: string;
  totalAmount?: number;
  lines: Array<{
    itemId: string;
    title: string;
    quantity: number;
  }>;
};

export async function sendOrderSoldNotification(input: OrderSoldNotificationInput) {
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

  await sendTelegramMessage(account.chatId, message);
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

export async function sendOutOfStockNotification(input: OutOfStockNotificationInput) {
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
