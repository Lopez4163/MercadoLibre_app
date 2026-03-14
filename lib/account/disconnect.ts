import { prisma } from "../db/prisma";

export async function disconnectUserIntegrationsForBillingEnd(userId: string) {
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: userId },
      data: {
        accessToken: "",
        refreshToken: "",
        tokenExpiresAt: new Date(0),
        mlAvatarUrl: null,
      },
    }),
    prisma.telegramAccount.deleteMany({
      where: { userId },
    }),
  ]);
}
