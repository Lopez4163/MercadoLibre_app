import { prisma } from "../db/prisma";

export type TelegramConnectTokenCleanupResult = {
  cutoffIso: string;
  deletedUsedTokens: number;
  deletedExpiredUnusedTokens: number;
  deletedTotal: number;
};

export async function cleanupTelegramConnectTokens(now = new Date()): Promise<TelegramConnectTokenCleanupResult> {
  const [usedTokensDeleted, expiredUnusedDeleted] = await prisma.$transaction([
    prisma.telegramConnectToken.deleteMany({
      where: {
        usedAt: {
          not: null,
        },
      },
    }),
    prisma.telegramConnectToken.deleteMany({
      where: {
        usedAt: null,
        expiresAt: {
          lt: now,
        },
      },
    }),
  ]);

  return {
    cutoffIso: now.toISOString(),
    deletedUsedTokens: usedTokensDeleted.count,
    deletedExpiredUnusedTokens: expiredUnusedDeleted.count,
    deletedTotal: usedTokensDeleted.count + expiredUnusedDeleted.count,
  };
}
