import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";

export async function GET(request: NextRequest) {
  const sessionUserId = request.cookies.get("ml_user_id")?.value;
  if (!sessionUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const account = await prisma.telegramAccount.findUnique({
    where: { userId: sessionUserId },
    select: { chatId: true },
  });

  return NextResponse.json(
    {
      ok: true,
      connected: Boolean(account?.chatId),
      chatId: account?.chatId ?? null,
    },
    { status: 200 },
  );
}
