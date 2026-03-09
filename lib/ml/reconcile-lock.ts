import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";

const RECONCILE_LOCK_NAME = "inventory_snapshot_reconcile";
const RECONCILE_LOCK_TTL_MS = 30 * 60 * 1000;

type ReconcileRunLock = {
  name: string;
  ownerId: string;
};

export async function acquireReconcileRunLock(): Promise<ReconcileRunLock | null> {
  const ownerId = randomUUID();
  let acquired = false;

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const lockExpiresAt = new Date(now.getTime() + RECONCILE_LOCK_TTL_MS);

    const existing = await tx.reconcileJobLock.findUnique({
      where: { name: RECONCILE_LOCK_NAME },
      select: { name: true },
    });

    if (!existing) {
      try {
        await tx.reconcileJobLock.create({
          data: {
            name: RECONCILE_LOCK_NAME,
            ownerId,
            lockedAt: now,
            lockExpiresAt,
          },
        });
        acquired = true;
        return;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
          throw error;
        }
      }
    }

    const updated = await tx.reconcileJobLock.updateMany({
      where: {
        name: RECONCILE_LOCK_NAME,
        OR: [{ lockExpiresAt: null }, { lockExpiresAt: { lte: now } }],
      },
      data: {
        ownerId,
        lockedAt: now,
        lockExpiresAt,
      },
    });

    acquired = updated.count === 1;
  });

  if (!acquired) {
    return null;
  }

  return {
    name: RECONCILE_LOCK_NAME,
    ownerId,
  };
}

export async function releaseReconcileRunLock(lock: ReconcileRunLock) {
  await prisma.reconcileJobLock.updateMany({
    where: {
      name: lock.name,
      ownerId: lock.ownerId,
    },
    data: {
      ownerId: null,
      lockedAt: null,
      lockExpiresAt: null,
    },
  });
}
