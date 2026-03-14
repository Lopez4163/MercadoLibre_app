import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { getSessionUserIdFromRequest } from "../../../../../lib/auth/session";
import { sendTelegramMessage } from "../../../../../lib/telegram/bot";
import {
  buildLowStockMessage,
  buildOrderLabelReadyMessage,
  buildOrderSoldMessage,
  buildOutOfStockMessage,
  buildTelegramTestPingMessage,
} from "../../../../../lib/telegram/messages";

type TestType = "sale" | "low_stock" | "sold_out" | "shipping_label" | "channel_health";

type TestPayload = {
  type?: TestType;
};

function isSupportedTestType(value: string): value is TestType {
  return (
    value === "sale" ||
    value === "low_stock" ||
    value === "sold_out" ||
    value === "shipping_label" ||
    value === "channel_health"
  );
}

export async function POST(request: NextRequest) {
  const sessionUserId = getSessionUserIdFromRequest(request);
  if (!sessionUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let payload: TestPayload;
  try {
    payload = (await request.json()) as TestPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (typeof payload.type !== "string" || !isSupportedTestType(payload.type)) {
    return NextResponse.json({ ok: false, error: "invalid_test_type" }, { status: 400 });
  }

  const [account, settings] = await Promise.all([
    prisma.telegramAccount.findUnique({
      where: { userId: sessionUserId },
      select: { chatId: true },
    }),
    prisma.notificationSettings.upsert({
      where: { userId: sessionUserId },
      create: { userId: sessionUserId },
      update: {},
      select: { lowStockThreshold: true },
    }),
  ]);

  if (!account?.chatId) {
    return NextResponse.json({ ok: false, error: "telegram_not_connected" }, { status: 400 });
  }

  let text: string;
  let inlineButtons: Array<{ text: string; url: string }> | undefined;

  if (payload.type === "sale") {
    text = buildOrderSoldMessage({
      orderId: `TEST-${Date.now().toString().slice(-6)}`,
      status: "paid",
      totalAmount: 139900,
      lines: [
        {
          itemId: "MLTEST123",
          title: "Sample listing A",
          quantity: 2,
        },
        {
          itemId: "MLTEST456",
          title: "Sample listing B",
          quantity: 1,
        },
      ],
    });
  } else if (payload.type === "low_stock") {
    const threshold = Math.max(0, settings.lowStockThreshold);
    const previousStock = Math.max(threshold + 2, 3);
    const currentStock = Math.max(0, threshold - 1);

    text = buildLowStockMessage({
      itemId: "MLTEST789",
      itemTitle: "Sample low stock listing",
      previousStock,
      currentStock,
      threshold,
      source: "items",
    });
  } else if (payload.type === "sold_out") {
    text = buildOutOfStockMessage({
      itemId: "MLTEST000",
      itemTitle: "Sample sold out listing",
      previousStock: 1,
      currentStock: 0,
      source: "items",
    });
  } else if (payload.type === "shipping_label") {
    const orderId = `TEST-${Date.now().toString().slice(-6)}`;
    const shipmentId = `SHP-${Date.now().toString().slice(-6)}`;
    text = buildOrderLabelReadyMessage({
      orderId,
      shipmentId,
      saleType: "other",
    });
    inlineButtons = [
      {
        text: "Download label",
        url: `https://www.mercadolibre.com.co/`,
      },
    ];
  } else {
    text = buildTelegramTestPingMessage();
  }

  try {
    await sendTelegramMessage(account.chatId, text, { inlineButtons });
    return NextResponse.json({ ok: true, type: payload.type }, { status: 200 });
  } catch (error) {
    console.error("notification test send failed", error);
    return NextResponse.json({ ok: false, error: "telegram_send_failed" }, { status: 502 });
  }
}
