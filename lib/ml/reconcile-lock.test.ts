import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  txFindUnique,
  txCreate,
  txUpdateMany,
  rootUpdateMany,
  transactionMock,
} = vi.hoisted(() => {
  const txFindUnique = vi.fn();
  const txCreate = vi.fn();
  const txUpdateMany = vi.fn();
  const rootUpdateMany = vi.fn();

  const transactionMock = vi.fn(async (callback: (tx: unknown) => Promise<void>) =>
    callback({
      reconcileJobLock: {
        findUnique: txFindUnique,
        create: txCreate,
        updateMany: txUpdateMany,
      },
    }),
  );

  return {
    txFindUnique,
    txCreate,
    txUpdateMany,
    rootUpdateMany,
    transactionMock,
  };
});

vi.mock("../db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    reconcileJobLock: {
      updateMany: rootUpdateMany,
    },
  },
}));

import { acquireReconcileRunLock, releaseReconcileRunLock } from "./reconcile-lock";

describe("reconcile lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txFindUnique.mockReset();
    txCreate.mockReset();
    txUpdateMany.mockReset();
    rootUpdateMany.mockReset();
  });

  it("acquires lock by creating it when it does not exist", async () => {
    txFindUnique.mockResolvedValue(null);
    txCreate.mockResolvedValue({ name: "inventory_snapshot_reconcile" });

    const lock = await acquireReconcileRunLock();

    expect(lock).not.toBeNull();
    expect(txCreate).toHaveBeenCalledTimes(1);
    expect(txUpdateMany).not.toHaveBeenCalled();
  });

  it("returns null when lock exists and is not expired", async () => {
    txFindUnique.mockResolvedValue({ name: "inventory_snapshot_reconcile" });
    txUpdateMany.mockResolvedValue({ count: 0 });

    const lock = await acquireReconcileRunLock();

    expect(lock).toBeNull();
    expect(txCreate).not.toHaveBeenCalled();
    expect(txUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("reclaims lock when existing lock is expired", async () => {
    txFindUnique.mockResolvedValue({ name: "inventory_snapshot_reconcile" });
    txUpdateMany.mockResolvedValue({ count: 1 });

    const lock = await acquireReconcileRunLock();

    expect(lock).not.toBeNull();
    expect(txUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("releases lock only for the owning run", async () => {
    await releaseReconcileRunLock({
      name: "inventory_snapshot_reconcile",
      ownerId: "owner-1",
    });

    expect(rootUpdateMany).toHaveBeenCalledTimes(1);
    expect(rootUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          name: "inventory_snapshot_reconcile",
          ownerId: "owner-1",
        },
        data: {
          ownerId: null,
          lockedAt: null,
          lockExpiresAt: null,
        },
      }),
    );
  });
});
