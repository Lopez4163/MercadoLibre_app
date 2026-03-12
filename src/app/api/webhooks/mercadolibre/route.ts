import { NextRequest, NextResponse } from "next/server";
import { processMercadoLibreWebhook } from "../../../../../lib/ml/webhooks";
import {
  getExpectedMlWebhookSecret,
  getProvidedMlWebhookSecret,
  verifyMlWebhookSecret,
} from "../../../../../lib/ml/webhook-auth";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "mercadolibre-webhook",
      message: "Mercado Libre webhook test endpoint is working.",
    },
    { status: 200 }
  );
}

export async function POST(request: NextRequest) {
  const isAuthorized = verifyMlWebhookSecret({
    expectedSecret: getExpectedMlWebhookSecret(),
    providedSecret: getProvidedMlWebhookSecret(request),
  });

  if (!isAuthorized) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  try {
    await processMercadoLibreWebhook({
      body,
      query: request.nextUrl.searchParams,
    });
  } catch (error) {
    console.error("mercadolibre webhook processing failed", error);
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
