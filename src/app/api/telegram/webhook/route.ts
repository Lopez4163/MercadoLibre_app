import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { consumeTelegramConnectCode } from "../../../../../lib/telegram/connect";
import {
  buildTelegramConnectedMessage,
  buildTelegramConnectionExpiredMessage,
} from "../../../../../lib/telegram/messages";
import { sendTelegramMessage } from "../../../../../lib/telegram/bot";

type TelegramWebhookUpdate = {
  update_id?: number;
  message?: {
    chat?: {
      id?: number;
    };
    text?: string;
  };
};

function extractStartToken(text?: string) {
  if (!text) {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed.startsWith("/start")) {
    return null;
  }

  const [, token] = trimmed.split(/\s+/, 2);
  return token ?? null;
}

async function processStartCommand(update: TelegramWebhookUpdate) {
  const token = extractStartToken(update.message?.text);
  const chatIdRaw = update.message?.chat?.id;

  if (!token || chatIdRaw === undefined || chatIdRaw === null) {
    return;
  }

  const payload = await consumeTelegramConnectCode(token);
  const chatId = String(chatIdRaw);

  if (!payload) {
    try {
      await sendTelegramMessage(chatId, buildTelegramConnectionExpiredMessage());
    } catch (error) {
      console.error("telegram webhook expired message failed", error);
    }
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true },
  });

  if (!user) {
    return;
  }

  await prisma.telegramAccount.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      chatId,
    },
    update: {
      chatId,
    },
  });

  try {
    await sendTelegramMessage(chatId, buildTelegramConnectedMessage());
  } catch (error) {
    console.error("telegram webhook connected message failed", error);
  }
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret) {
    const headerSecret = request.headers.get("x-telegram-bot-api-secret-token");
    if (headerSecret !== expectedSecret) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  let body: TelegramWebhookUpdate;

  try {
    body = (await request.json()) as TelegramWebhookUpdate;
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  processStartCommand(body).catch((error) => {
    console.error("telegram webhook processing failed", error);
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
