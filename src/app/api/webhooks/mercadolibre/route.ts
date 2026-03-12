import { NextRequest, NextResponse } from "next/server";
import { processMercadoLibreWebhook } from "../../../../../lib/ml/webhooks";
import {
  getExpectedMlWebhookSecret,
  getProvidedMlWebhookSecret,
  verifyMlWebhookSecret,
} from "../../../../../lib/ml/webhook-auth";

function secretFingerprint(secret: string | null | undefined) {
  if (!secret) {
    return null;
  }

  const normalized = secret.trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length <= 8) {
    return `${normalized[0] ?? ""}***${normalized.at(-1) ?? ""}`;
  }

  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
}

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
  const expectedSecret = getExpectedMlWebhookSecret();
  const providedSecret = getProvidedMlWebhookSecret(request);
  const isAuthorized = verifyMlWebhookSecret({
    expectedSecret,
    providedSecret,
  });

  if (!isAuthorized) {
    const expectedCount = (expectedSecret ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean).length;

    console.warn("[ML webhook] forbidden", {
      path: request.nextUrl.pathname,
      topic: request.nextUrl.searchParams.get("topic"),
      userId:
        request.nextUrl.searchParams.get("user_id") ??
        request.nextUrl.searchParams.get("caller_id"),
      applicationId:
        request.nextUrl.searchParams.get("application_id") ??
        request.nextUrl.searchParams.get("app_id"),
      hasHeaderSecret: Boolean(request.headers.get("x-ml-webhook-secret")),
      hasQuerySecret:
        request.nextUrl.searchParams.has("secret") ||
        request.nextUrl.searchParams.has("webhook_secret"),
      providedSecretFingerprint: secretFingerprint(providedSecret),
      providedSecretLength: providedSecret?.trim().length ?? 0,
      expectedSecretConfigured: Boolean(expectedSecret?.trim()),
      expectedSecretCount: expectedCount,
    });

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
