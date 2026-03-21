import { beforeEach, describe, expect, it, vi } from "vitest";

const { transactionMock, deleteManyUsedMock, deleteManyExpiredMock, deleteManyMock } = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  deleteManyUsedMock: vi.fn(),
  deleteManyExpiredMock: vi.fn(),
  deleteManyMock: vi.fn(),
}));

vi.mock("../db/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    telegramConnectToken: {
      deleteMany: deleteManyMock,
    },
  },
}));

import { cleanupTelegramConnectTokens } from "./connect-token-cleanup";

describe("cleanupTelegramConnectTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteManyUsedMock.mockReset();
    deleteManyExpiredMock.mockReset();
    deleteManyMock.mockReset();
    transactionMock.mockReset();

    deleteManyMock
      .mockImplementationOnce(deleteManyUsedMock)
      .mockImplementationOnce(deleteManyExpiredMock);
    transactionMock.mockImplementation(async (ops: Array<Promise<{ count: number }>>) => Promise.all(ops));
  });

  it("deletes used and expired-unused tokens and returns totals", async () => {
    deleteManyUsedMock.mockResolvedValue({ count: 4 });
    deleteManyExpiredMock.mockResolvedValue({ count: 7 });

    const now = new Date("2026-03-21T15:00:00.000Z");
    const result = await cleanupTelegramConnectTokens(now);

    expect(deleteManyUsedMock).toHaveBeenCalledWith({
      where: {
        usedAt: {
          not: null,
        },
      },
    });
    expect(deleteManyExpiredMock).toHaveBeenCalledWith({
      where: {
        usedAt: null,
        expiresAt: {
          lt: now,
        },
      },
    });
    expect(result).toEqual({
      cutoffIso: "2026-03-21T15:00:00.000Z",
      deletedUsedTokens: 4,
      deletedExpiredUnusedTokens: 7,
      deletedTotal: 11,
    });
  });
});
