import { prisma } from "../db/prisma";
import { sendLowStockNotification, sendOutOfStockNotification } from "../notifications/sender";
import { getItemsByIds, getSellerItemIds } from "./api";
import { withUserMlAccessToken } from "./tokens";

type ReconcileUser = {
  id: string;
  mlUserId: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
};

type ReconcileOptions = {
  userBatchSize?: number;
};

export type ReconcileResult = {
  usersProcessed: number;
  usersFailed: number;
  itemsChecked: number;
  itemsUpdated: number;
  soldOutAlertsSent: number;
  lowStockAlertsSent: number;
};

function toPositiveInt(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

async function getNotificationSettings(userId: string) {
  return prisma.notificationSettings.upsert({
    where: { userId },
    create: {
      userId,
    },
    update: {},
    select: {
      lowStockThreshold: true,
    },
  });
}

async function reconcileUser(user: ReconcileUser) {
  const notificationSettings = await getNotificationSettings(user.id);
  const threshold = notificationSettings.lowStockThreshold;

  return withUserMlAccessToken(user, async (accessToken) => {
    const itemIds = await getSellerItemIds({
      accessToken,
      mlUserId: user.mlUserId,
      status: "active",
    });

    if (itemIds.length === 0) {
      return {
        itemsChecked: 0,
        itemsUpdated: 0,
        soldOutAlertsSent: 0,
        lowStockAlertsSent: 0,
      };
    }

    const mlItems = await getItemsByIds({
      accessToken,
      itemIds,
    });

    const snapshots = await prisma.item.findMany({
      where: {
        userId: user.id,
      },
      select: {
        mlItemId: true,
        stock: true,
        lowStockAlertedAt: true,
      },
    });

    const snapshotMap = new Map(snapshots.map((item) => [item.mlItemId, item]));

    let itemsUpdated = 0;
    let soldOutAlertsSent = 0;
    let lowStockAlertsSent = 0;

    for (const raw of mlItems as Array<{
      id?: string;
      title?: string;
      available_quantity?: number;
      status?: string;
    }>) {
      const itemId = typeof raw.id === "string" ? raw.id : null;
      const stock = Number(raw.available_quantity);
      if (!itemId || !Number.isFinite(stock)) {
        continue;
      }

      const itemTitle = typeof raw.title === "string" && raw.title.length > 0 ? raw.title : itemId;
      const existing = snapshotMap.get(itemId);
      const previousStock = existing?.stock ?? stock;
      const currentStock = stock;

      const shouldResetLowStockFlag = currentStock > threshold;
      const nextLowStockAlertedAt = shouldResetLowStockFlag ? null : existing?.lowStockAlertedAt ?? null;

      const changed =
        !existing ||
        existing.stock !== currentStock ||
        (shouldResetLowStockFlag && existing.lowStockAlertedAt !== null);

      if (changed) {
        itemsUpdated += 1;
      }

      await prisma.item.upsert({
        where: {
          userId_mlItemId: {
            userId: user.id,
            mlItemId: itemId,
          },
        },
        create: {
          userId: user.id,
          mlItemId: itemId,
          name: itemTitle,
          stock: currentStock,
          threshold,
          lowStockAlertedAt: nextLowStockAlertedAt,
        },
        update: {
          name: itemTitle,
          stock: currentStock,
          threshold,
          lowStockAlertedAt: nextLowStockAlertedAt,
        },
      });

      const crossedIntoLowStock = previousStock > threshold && currentStock <= threshold && currentStock > 0;
      if (crossedIntoLowStock && !existing?.lowStockAlertedAt) {
        const notifyResult = await sendLowStockNotification({
          userId: user.id,
          itemId,
          itemTitle,
          previousStock,
          currentStock,
          threshold,
          source: "items",
        }).catch(() => ({ sent: false as const }));

        if (notifyResult.sent) {
          lowStockAlertsSent += 1;
          await prisma.item.update({
            where: {
              userId_mlItemId: {
                userId: user.id,
                mlItemId: itemId,
              },
            },
            data: {
              lowStockAlertedAt: new Date(),
            },
          });
        }
      }

      if (previousStock > 0 && currentStock === 0) {
        const notifyResult = await sendOutOfStockNotification({
          userId: user.id,
          itemId,
          itemTitle,
          previousStock,
          currentStock,
          source: "items",
        }).catch(() => ({ sent: false as const }));

        if (notifyResult.sent) {
          soldOutAlertsSent += 1;
        }
      }
    }

    return {
      itemsChecked: mlItems.length,
      itemsUpdated,
      soldOutAlertsSent,
      lowStockAlertsSent,
    };
  });
}

export async function reconcileInventorySnapshots(options?: ReconcileOptions): Promise<ReconcileResult> {
  const userBatchSize =
    options?.userBatchSize ?? toPositiveInt(process.env.RECONCILE_USER_BATCH_SIZE, 10);

  const result: ReconcileResult = {
    usersProcessed: 0,
    usersFailed: 0,
    itemsChecked: 0,
    itemsUpdated: 0,
    soldOutAlertsSent: 0,
    lowStockAlertsSent: 0,
  };

  let cursorId: string | null = null;

  while (true) {
    const users: ReconcileUser[] = await prisma.user.findMany({
      where: {
        mlUserId: { not: "" },
      },
      select: {
        id: true,
        mlUserId: true,
        accessToken: true,
        refreshToken: true,
        tokenExpiresAt: true,
      },
      orderBy: { id: "asc" },
      take: userBatchSize,
      ...(cursorId
        ? {
            cursor: { id: cursorId },
            skip: 1,
          }
        : {}),
    });

    if (users.length === 0) {
      break;
    }

    for (const user of users) {
      try {
        const userResult = await reconcileUser(user);
        result.usersProcessed += 1;
        result.itemsChecked += userResult.itemsChecked;
        result.itemsUpdated += userResult.itemsUpdated;
        result.soldOutAlertsSent += userResult.soldOutAlertsSent;
        result.lowStockAlertsSent += userResult.lowStockAlertsSent;
      } catch (error) {
        result.usersFailed += 1;
        console.error("[ML reconcile] user failed", {
          userId: user.id,
          mlUserId: user.mlUserId,
          error: error instanceof Error ? error.message : "unknown_error",
        });
      }
    }

    cursorId = users[users.length - 1]?.id ?? null;
  }

  return result;
}
