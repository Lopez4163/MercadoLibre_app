import { NextRequest, NextResponse } from "next/server";
import { reconcileInventorySnapshots } from "../../../../../lib/ml/reconcile";

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
  }
}
