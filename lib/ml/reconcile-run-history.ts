import { prisma } from "../db/prisma";
import type { ReconcileResult } from "./reconcile";

const DEFAULT_RECONCILE_RUN_RETENTION_DAYS = 30;

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

export async function startReconcileRun(triggerSource: string) {
  const run = await prisma.reconcileRun.create({
    data: {
      status: "running",
      triggerSource,
    },
    select: {
      id: true,
      startedAt: true,
    },
  });

  return run;
}

export async function finishReconcileRunSuccess(options: {
  runId: string;
  result: ReconcileResult;
  durationMs: number;
}) {
  const { runId, result, durationMs } = options;

  await prisma.reconcileRun.update({
    where: { id: runId },
    data: {
      status: "success",
      finishedAt: new Date(),
      durationMs,
      usersProcessed: result.usersProcessed,
      usersFailed: result.usersFailed,
      itemsChecked: result.itemsChecked,
      itemsUpdated: result.itemsUpdated,
      soldOutAlertsSent: result.soldOutAlertsSent,
      lowStockAlertsSent: result.lowStockAlertsSent,
      errorMessage: null,
    },
  });
}

export async function finishReconcileRunFailure(options: {
  runId: string;
  error: unknown;
  durationMs: number;
}) {
  const { runId, error, durationMs } = options;

  await prisma.reconcileRun.update({
    where: { id: runId },
    data: {
      status: "failed",
      finishedAt: new Date(),
      durationMs,
      errorMessage: error instanceof Error ? error.message : "unknown_error",
    },
  });
}

export async function cleanupOldReconcileRuns() {
  const retentionDays = toPositiveInt(
    process.env.RECONCILE_RUN_RETENTION_DAYS,
    DEFAULT_RECONCILE_RUN_RETENTION_DAYS,
  );

  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const deleted = await prisma.reconcileRun.deleteMany({
    where: {
      startedAt: {
        lt: cutoffDate,
      },
    },
  });

  return {
    retentionDays,
    deletedCount: deleted.count,
    cutoffDate,
  };
}
