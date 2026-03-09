import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { sendTelegramMessage } from "../../../../../lib/telegram/bot";
import { buildTelegramTestPingMessage } from "../../../../../lib/telegram/messages";
import { getSessionUserIdFromRequest } from "../../../../../lib/auth/session";

export async function POST(request: NextRequest) {
  const sessionUserId = getSessionUserIdFromRequest(request);
  if (!sessionUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const account = await prisma.telegramAccount.findUnique({
    where: { userId: sessionUserId },
    select: { chatId: true },
  });

  if (!account?.chatId) {
    return NextResponse.json({ ok: false, error: "telegram_not_connected" }, { status: 400 });
  }

  try {
    await sendTelegramMessage(account.chatId, buildTelegramTestPingMessage());
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("telegram test ping failed", error);
    return NextResponse.json({ ok: false, error: "telegram_send_failed" }, { status: 502 });
  }
}
