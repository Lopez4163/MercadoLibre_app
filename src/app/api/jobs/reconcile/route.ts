import { NextRequest, NextResponse } from "next/server";
import { reconcileInventorySnapshots } from "../../../../../lib/ml/reconcile";
import { acquireReconcileRunLock, releaseReconcileRunLock } from "../../../../../lib/ml/reconcile-lock";
import {
  cleanupOldReconcileRuns,
  finishReconcileRunFailure,
  finishReconcileRunSuccess,
  startReconcileRun,
} from "../../../../../lib/ml/reconcile-run-history";

function isAuthorized(request: NextRequest) {
  const secret = process.env.RECONCILE_CRON_SECRET;
  if (!secret) {
    return false;
  }

  const headerSecret = request.headers.get("x-reconcile-secret");
  return headerSecret === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const lock = await acquireReconcileRunLock();
  if (!lock) {
    return NextResponse.json(
      { ok: false, error: "already_running", message: "reconcile job already in progress" },
      { status: 409 },
    );
  }

  const startedAt = Date.now();
  const run = await startReconcileRun("api_jobs_reconcile");

  try {
    const result = await reconcileInventorySnapshots();
    const durationMs = Date.now() - startedAt;
    await finishReconcileRunSuccess({
      runId: run.id,
      result,
      durationMs,
    });

    return NextResponse.json(
      {
        ok: true,
        schedule: "every_10_minutes",
        runId: run.id,
        result,
        durationMs,
      },
      { status: 200 },
    );
  } catch (error) {
    await finishReconcileRunFailure({
      runId: run.id,
      error,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
      {
        ok: false,
        runId: run.id,
        error: "reconcile_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  } finally {
    try {
      await cleanupOldReconcileRuns();
    } catch (error) {
      console.error("[ML reconcile] run history cleanup failed", error);
    }

    try {
      await releaseReconcileRunLock(lock);
    } catch (error) {
      console.error("[ML reconcile] lock release failed", error);
    }
  }
}
