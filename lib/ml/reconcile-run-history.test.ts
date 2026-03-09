import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock, updateMock, deleteManyMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
  deleteManyMock: vi.fn(),
}));

vi.mock("../db/prisma", () => ({
  prisma: {
    reconcileRun: {
      create: createMock,
      update: updateMock,
      deleteMany: deleteManyMock,
    },
  },
}));

import {
  cleanupOldReconcileRuns,
  finishReconcileRunFailure,
  finishReconcileRunSuccess,
  startReconcileRun,
} from "./reconcile-run-history";

describe("reconcile run history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createMock.mockReset();
    updateMock.mockReset();
    deleteManyMock.mockReset();
    delete process.env.RECONCILE_RUN_RETENTION_DAYS;
  });

  it("creates a running run record", async () => {
    const startedAt = new Date("2026-03-08T00:00:00.000Z");
    createMock.mockResolvedValue({ id: "run_1", startedAt });

    const run = await startReconcileRun("api_jobs_reconcile");

    expect(run).toEqual({ id: "run_1", startedAt });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: "running",
          triggerSource: "api_jobs_reconcile",
        },
      }),
    );
  });

  it("stores success metrics on completion", async () => {
    updateMock.mockResolvedValue({ id: "run_1" });

    await finishReconcileRunSuccess({
      runId: "run_1",
      durationMs: 1500,
      result: {
        usersProcessed: 2,
        usersFailed: 1,
        itemsChecked: 10,
        itemsUpdated: 7,
        soldOutAlertsSent: 1,
        lowStockAlertsSent: 2,
      },
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run_1" },
        data: expect.objectContaining({
          status: "success",
          durationMs: 1500,
          usersProcessed: 2,
          usersFailed: 1,
          itemsChecked: 10,
          itemsUpdated: 7,
          soldOutAlertsSent: 1,
          lowStockAlertsSent: 2,
          errorMessage: null,
        }),
      }),
    );
  });

  it("stores failure details on completion", async () => {
    updateMock.mockResolvedValue({ id: "run_1" });

    await finishReconcileRunFailure({
      runId: "run_1",
      durationMs: 900,
      error: new Error("ml timeout"),
    });

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run_1" },
        data: expect.objectContaining({
          status: "failed",
          durationMs: 900,
          errorMessage: "ml timeout",
        }),
      }),
    );
  });

  it("deletes history older than retention window", async () => {
    process.env.RECONCILE_RUN_RETENTION_DAYS = "14";
    deleteManyMock.mockResolvedValue({ count: 3 });

    const result = await cleanupOldReconcileRuns();

    expect(result.retentionDays).toBe(14);
    expect(result.deletedCount).toBe(3);
    expect(deleteManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          startedAt: {
            lt: expect.any(Date),
          },
        },
      }),
    );
  });
});
