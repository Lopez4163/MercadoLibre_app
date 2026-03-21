import { NextRequest, NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "../../../../../../lib/auth/session";
import { prisma } from "../../../../../../lib/db/prisma";

const ORDER_LABEL_LINK_TOPIC = "order_label_link";

export async function POST(request: NextRequest) {
  const sessionUserId = getSessionUserIdFromRequest(request);
  if (!sessionUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const revokeEvent = await prisma.mlWebhookEvent.create({
    data: {
      eventKey: `order_label_link_revoke_all:${sessionUserId}:${Date.now()}`,
      userId: sessionUserId,
      topic: ORDER_LABEL_LINK_TOPIC,
      action: "revoked_all",
      resource: "/orders/labels/revoke",
    },
    select: {
      id: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    revokedAt: revokeEvent.createdAt.toISOString(),
  });
}
