import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";

function isAuthorized(request: NextRequest) {
  const secret = process.env.ORDERS_CLEANUP_CRON_SECRET;
  if (!secret) {
    return false;
  }

  const headerSecret = request.headers.get("x-orders-cleanup-secret");
  return headerSecret === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  try {
    const now = new Date();
    const deleted = await prisma.order.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        schedule: "daily",
        cutoff: now.toISOString(),
        deletedOrders: deleted.count,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "orders_cleanup_failed",
        message: error instanceof Error ? error.message : "unknown_error",
      },
      { status: 500 },
    );
  }
}
