import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import {
  createTelegramConnectCode,
  TELEGRAM_CONNECT_CODE_TTL_SECONDS,
} from "../../../../../lib/telegram/connect";
import { getSessionUserIdFromRequest } from "../../../../../lib/auth/session";

export async function GET(request: NextRequest) {
  const sessionUserId = getSessionUserIdFromRequest(request);
  if (!sessionUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { code: startToken } = await createTelegramConnectCode(user.id);
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;

  return NextResponse.json(
    {
      ok: true,
      startToken,
      connectUrl: botUsername ? `https://t.me/${botUsername}?start=${startToken}` : null,
      expiresInSeconds: TELEGRAM_CONNECT_CODE_TTL_SECONDS,
      requiresBotUsername: !botUsername,
    },
    { status: 200 },
  );
}
