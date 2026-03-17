import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../../../lib/db/prisma";
import { getSessionUserIdFromRequest } from "../../../../../lib/auth/session";

export async function GET(request: NextRequest) {
  const sessionUserId = getSessionUserIdFromRequest(request);
  if (!sessionUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2024") {
      return NextResponse.json(
        { ok: false, error: "database_busy" },
        { status: 503 },
      );
    }

    throw error;
  }
}
