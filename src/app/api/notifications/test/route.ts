import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { getSessionUserIdFromRequest } from "../../../../../lib/auth/session";
import { getUserBillingEntitlement } from "../../../../../lib/billing/entitlements";
import { sendOrderLabelReadyNotification } from "../../../../../lib/notifications/sender";
import { sendTelegramMessage } from "../../../../../lib/telegram/bot";
import {
  buildLowStockMessage,
  buildOrderLabelReadyMessage,
  buildOrderSoldMessage,
  buildOutOfStockMessage,
  buildTelegramTestPingMessage,
} from "../../../../../lib/telegram/messages";
import {
  buildRateLimitHeaders,
  buildRateLimitKey,
  consumeRateLimit,
  getRequestIp,
  RateLimitConfigurationError,
  RateLimitUnavailableError,
  type RateLimitDecision,
} from "../../../../../lib/utils/rate-limit";

type TestType = "sale" | "low_stock" | "sold_out" | "shipping_label" | "channel_health";

type TestPayload = {
  type?: TestType;
};

const NOTIFICATION_TEST_RATE_LIMIT = {
  limit: 10,
  windowMs: 60_000,
};

function buildSampleLabelPdf() {
  const samplePdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 53 >>
stream
BT
/F1 16 Tf
24 120 Td
(MercadoLibs Sample Shipping Label) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000241 00000 n
0000000311 00000 n
trailer
<< /Root 1 0 R /Size 6 >>
startxref
413
%%EOF`;

  return {
    data: new TextEncoder().encode(samplePdf).buffer,
    fileName: "sample-shipping-label.pdf",
    contentType: "application/pdf",
  };
}

function isSupportedTestType(value: string): value is TestType {
  return (
    value === "sale" ||
    value === "low_stock" ||
    value === "sold_out" ||
    value === "shipping_label" ||
    value === "channel_health"
  );
}

export async function POST(request: NextRequest) {
  const sessionUserId = getSessionUserIdFromRequest(request);
  if (!sessionUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const entitlement = await getUserBillingEntitlement(sessionUserId);
  if (!entitlement.hasAccess) {
    return NextResponse.json(
      {
        ok: false,
        error: "subscription_required",
        message: "Active subscription required. Start trial in Billing to send notification tests.",
        subscriptionStatus: entitlement.status,
      },
      { status: 402 },
    );
  }

  let rateLimitDecision: RateLimitDecision;
  try {
    rateLimitDecision = await consumeRateLimit({
      key: buildRateLimitKey("api_notifications_test_post", sessionUserId, getRequestIp(request)),
      limit: NOTIFICATION_TEST_RATE_LIMIT.limit,
      windowMs: NOTIFICATION_TEST_RATE_LIMIT.windowMs,
    });
  } catch (error) {
    if (error instanceof RateLimitConfigurationError || error instanceof RateLimitUnavailableError) {
      return NextResponse.json(
        { ok: false, error: "rate_limit_unavailable", message: "Rate limiter is unavailable. Contact support." },
        { status: 500 },
      );
    }
    throw error;
  }

  if (!rateLimitDecision.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "rate_limited",
        message: "Too many test notification requests. Please wait and try again.",
      },
      {
        status: 429,
        headers: buildRateLimitHeaders(rateLimitDecision),
      },
    );
  }

  let payload: TestPayload;
  try {
    payload = (await request.json()) as TestPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (typeof payload.type !== "string" || !isSupportedTestType(payload.type)) {
    return NextResponse.json({ ok: false, error: "invalid_test_type" }, { status: 400 });
  }

  const [account, settings] = await Promise.all([
    prisma.telegramAccount.findUnique({
      where: { userId: sessionUserId },
      select: { chatId: true },
    }),
    prisma.notificationSettings.upsert({
      where: { userId: sessionUserId },
      create: { userId: sessionUserId },
      update: {},
      select: { lowStockThreshold: true },
    }),
  ]);

  if (!account?.chatId) {
    return NextResponse.json({ ok: false, error: "telegram_not_connected" }, { status: 400 });
  }

  let text: string;
  let inlineButtons: Array<{ text: string; url: string }> | undefined;

  if (payload.type === "sale") {
    text = buildOrderSoldMessage({
      orderId: `TEST-${Date.now().toString().slice(-6)}`,
      status: "paid",
      totalAmount: 139900,
      lines: [
        {
          itemId: "MLTEST123",
          title: "Sample listing A",
          quantity: 2,
        },
        {
          itemId: "MLTEST456",
          title: "Sample listing B",
          quantity: 1,
        },
      ],
    });
  } else if (payload.type === "low_stock") {
    const threshold = Math.max(0, settings.lowStockThreshold);
    const previousStock = Math.max(threshold + 2, 3);
    const currentStock = Math.max(0, threshold - 1);

    text = buildLowStockMessage({
      itemId: "MLTEST789",
      itemTitle: "Sample low stock listing",
      previousStock,
      currentStock,
      threshold,
      source: "items",
    });
  } else if (payload.type === "sold_out") {
    text = buildOutOfStockMessage({
      itemId: "MLTEST000",
      itemTitle: "Sample sold out listing",
      previousStock: 1,
      currentStock: 0,
      source: "items",
    });
  } else if (payload.type === "shipping_label") {
    text = buildOrderLabelReadyMessage({
      orderId: "-",
      shipmentId: "-",
      saleType: "other",
    });
  } else {
    text = buildTelegramTestPingMessage();
  }

  try {
    if (payload.type === "shipping_label") {
      const orderId = `TEST-${Date.now().toString().slice(-6)}`;
      const shipmentId = `SHP-${Date.now().toString().slice(-6)}`;
      const result = await sendOrderLabelReadyNotification({
        userId: sessionUserId,
        orderId,
        shipmentId,
        saleType: "other",
        lines: [
          { title: "Sample listing A", quantity: 2 },
          { title: "Sample listing B", quantity: 1 },
        ],
        labelDocument: buildSampleLabelPdf(),
        inlineButtons: [
          {
            text: "Download Label",
            url: "https://www.mercadolibre.com.co/",
          },
        ],
      });

      if (!result.sent) {
        return NextResponse.json(
          { ok: false, error: result.reason },
          { status: 400, headers: buildRateLimitHeaders(rateLimitDecision) },
        );
      }
    } else {
      await sendTelegramMessage(account.chatId, text, { inlineButtons });
    }
    return NextResponse.json(
      { ok: true, type: payload.type },
      { status: 200, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  } catch (error) {
    console.error("notification test send failed", error);
    return NextResponse.json(
      { ok: false, error: "telegram_send_failed" },
      { status: 502, headers: buildRateLimitHeaders(rateLimitDecision) },
    );
  }
}
