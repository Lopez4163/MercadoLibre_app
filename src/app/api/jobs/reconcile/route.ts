import { NextRequest, NextResponse } from "next/server";
import { reconcileInventorySnapshots } from "../../../../../lib/ml/reconcile";
import { acquireReconcileRunLock, releaseReconcileRunLock } from "../../../../../lib/ml/reconcile-lock";

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

  try {
    const result = await reconcileInventorySnapshots();
    const durationMs = Date.now() - startedAt;

    return NextResponse.json(
      {
        ok: true,
        schedule: "every_10_minutes",
        result,
        durationMs,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "reconcile_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  } finally {
    try {
      await releaseReconcileRunLock(lock);
    } catch (error) {
      console.error("[ML reconcile] lock release failed", error);
    }
  }
}
