import { NextRequest, NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "../../../../../../lib/auth/session";
import { getUserBillingEntitlement } from "../../../../../../lib/billing/entitlements";
import { prisma } from "../../../../../../lib/db/prisma";
import { getOrderLabelTokenPayload } from "../../../../../../lib/labels/token";
import { getPrimaryOrderShipment, getShipmentLabelDocument } from "../../../../../../lib/ml/api";
import { withUserMlAccessToken } from "../../../../../../lib/ml/tokens";

const ORDER_LABEL_LINK_TOPIC = "order_label_link";

function buildHtmlFallback(title: string, message: string, status: number) {
  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        font-family: Georgia, serif;
        background: linear-gradient(160deg, #f6f1e8 0%, #e6edf3 100%);
        color: #1f2a37;
        min-height: 100vh;
        display: grid;
        place-items: center;
      }
      main {
        width: min(92vw, 540px);
        padding: 32px 28px;
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.92);
        box-shadow: 0 20px 60px rgba(31, 42, 55, 0.16);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 28px;
      }
      p {
        margin: 0;
        font-size: 16px;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
    </main>
  </body>
</html>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    },
  );
}

function isLabelNotReadyError(message: string) {
  return (
    message.includes(" 404") ||
    message.includes("not found") ||
    message.includes("not_printable_status") ||
    message.includes("invalid_shipment_ff_public")
  );
}

function toIsoDateFromUnixSeconds(seconds: number) {
  return new Date(seconds * 1000);
}

async function hasUserRevokedPendingLabelLinks(userId: string, tokenIssuedAtSeconds: number) {
  const latestRevocation = await prisma.mlWebhookEvent.findFirst({
    where: {
      userId,
      topic: ORDER_LABEL_LINK_TOPIC,
      action: "revoked_all",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      createdAt: true,
    },
  });

  if (!latestRevocation) {
    return false;
  }

  return latestRevocation.createdAt >= toIsoDateFromUnixSeconds(tokenIssuedAtSeconds);
}

async function isOrderLabelTokenAlreadyUsed(tokenId: string) {
  const existing = await prisma.mlWebhookEvent.findUnique({
    where: {
      eventKey: `order_label_link_used:${tokenId}`,
    },
    select: {
      id: true,
    },
  });

  return Boolean(existing);
}

async function markOrderLabelTokenUsed(input: {
  tokenId: string;
  userId: string;
  orderId: string;
}) {
  const created = await prisma.mlWebhookEvent
    .create({
      data: {
        eventKey: `order_label_link_used:${input.tokenId}`,
        userId: input.userId,
        topic: ORDER_LABEL_LINK_TOPIC,
        action: "used",
        resource: `/orders/${input.orderId}`,
      },
      select: { id: true },
    })
    .catch(() => null);

  if (!created) {
    return false;
  }

  await prisma.mlWebhookEvent
    .create({
      data: {
        eventKey: `order_label_link_access:${input.tokenId}:${Date.now()}`,
        userId: input.userId,
        topic: ORDER_LABEL_LINK_TOPIC,
        action: "access_granted",
        resource: `/orders/${input.orderId}`,
      },
      select: { id: true },
    })
    .catch(() => null);

  return true;
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ orderId: string }>;
  },
) {
  const { orderId } = await context.params;
  const token = request.nextUrl.searchParams.get("token") ?? undefined;
  const tokenPayload = getOrderLabelTokenPayload(token);

  if (!tokenPayload || tokenPayload.orderId !== orderId) {
    return buildHtmlFallback("Invalid link", "This shipping label link is invalid or has expired.", 401);
  }

  if (await hasUserRevokedPendingLabelLinks(tokenPayload.userId, tokenPayload.issuedAt)) {
    return buildHtmlFallback("Invalid link", "This shipping label link is invalid or has expired.", 401);
  }

  if (await isOrderLabelTokenAlreadyUsed(tokenPayload.tokenId)) {
    return buildHtmlFallback("Link already used", "This shipping label link has already been used.", 409);
  }

  const sessionUserId = getSessionUserIdFromRequest(request);
  if (sessionUserId && sessionUserId !== tokenPayload.userId) {
    await prisma.mlWebhookEvent
      .create({
        data: {
          eventKey: `order_label_link_access_denied:${tokenPayload.tokenId}:${Date.now()}`,
          userId: tokenPayload.userId,
          topic: ORDER_LABEL_LINK_TOPIC,
          action: "access_denied_session_mismatch",
          resource: `/orders/${tokenPayload.orderId}`,
        },
        select: { id: true },
      })
      .catch(() => null);
    return buildHtmlFallback("Not authorized", "This shipping label link does not belong to your account.", 403);
  }

  const conflictingOrderOwner = await prisma.order.findFirst({
    where: {
      mlOrderId: tokenPayload.orderId,
      userId: {
        not: tokenPayload.userId,
      },
    },
    select: {
      userId: true,
    },
  });
  if (conflictingOrderOwner) {
    return buildHtmlFallback("Not authorized", "This shipping label link does not belong to your account.", 403);
  }

  const user = await prisma.user.findUnique({
    where: { id: tokenPayload.userId },
    select: {
      id: true,
      accessToken: true,
      refreshToken: true,
      tokenExpiresAt: true,
    },
  });

  if (!user) {
    return buildHtmlFallback("Not authorized", "The account for this shipping label is no longer available.", 404);
  }

  const entitlement = await getUserBillingEntitlement(tokenPayload.userId);
  if (!entitlement.hasAccess) {
    return buildHtmlFallback("Subscription required", "Start trial in Billing to access shipping labels.", 402);
  }

  try {
    const document = await withUserMlAccessToken(user, async (accessToken) => {
      const shipmentId =
        tokenPayload.shipmentId ??
        (
          await getPrimaryOrderShipment({
            accessToken,
            orderId: tokenPayload.orderId,
          })
        )?.id ??
        null;

      if (!shipmentId) {
        return null;
      }

      return getShipmentLabelDocument({
        accessToken,
        shipmentId,
      });
    });

    if (!document) {
      return buildHtmlFallback("Label not ready", "This order does not have a printable label yet. Try again shortly.", 404);
    }

    const markedAsUsed = await markOrderLabelTokenUsed({
      tokenId: tokenPayload.tokenId,
      userId: tokenPayload.userId,
      orderId: tokenPayload.orderId,
    });
    if (!markedAsUsed) {
      return buildHtmlFallback("Link already used", "This shipping label link has already been used.", 409);
    }

    return new NextResponse(document.data, {
      status: 200,
      headers: {
        "content-type": document.contentType,
        "content-disposition": `attachment; filename="${document.fileName}"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (isLabelNotReadyError(message)) {
      return buildHtmlFallback("Label not ready", "This order does not have a printable label yet. Try again shortly.", 404);
    }

    console.error("order label fetch failed", {
      orderId: tokenPayload.orderId,
      shipmentId: tokenPayload.shipmentId,
      error,
    });

    return buildHtmlFallback("Label unavailable", "The shipping label could not be loaded right now. Try again shortly.", 502);
  }
}
