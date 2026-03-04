import { randomBytes } from "crypto";
import { prisma } from "../db/prisma";

export const TELEGRAM_CONNECT_CODE_TTL_SECONDS = 60 * 10;

type TelegramConnectCodePayload = {
  userId: string;
  code: string;
};

function generateConnectCode() {
  // Telegram start payload must stay short; 24 random bytes => 32 url-safe chars.
  return randomBytes(24).toString("base64url");
}

export async function createTelegramConnectCode(userId: string): Promise<TelegramConnectCodePayload> {
  const code = generateConnectCode();
  const expiresAt = new Date(Date.now() + TELEGRAM_CONNECT_CODE_TTL_SECONDS * 1000);

  await prisma.$transaction([
    prisma.telegramConnectToken.deleteMany({
      where: {
        userId,
        usedAt: null,
      },
    }),
    prisma.telegramConnectToken.create({
      data: {
        code,
        userId,
        expiresAt,
      },
    }),
  ]);

  return { userId, code };
}

export async function consumeTelegramConnectCode(code: string): Promise<TelegramConnectCodePayload | null> {
  if (!code) {
    return null;
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const token = await tx.telegramConnectToken.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    if (!token || token.usedAt || token.expiresAt <= now) {
      return null;
    }

    const updated = await tx.telegramConnectToken.updateMany({
      where: {
        id: token.id,
        usedAt: null,
      },
      data: {
        usedAt: now,
      },
    });

    if (updated.count !== 1) {
      return null;
    }

    return {
      userId: token.userId,
      code: token.code,
    };
  });

  return result;
}
