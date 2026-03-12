import type { NextRequest } from "next/server";

const ML_WEBHOOK_SECRET_HEADER = "x-ml-webhook-secret";
const ML_WEBHOOK_QUERY_KEYS = ["secret", "webhook_secret"];

export function getExpectedMlWebhookSecret() {
  return process.env.ML_WEBHOOK_SECRET;
}

export function getProvidedMlWebhookSecret(request: NextRequest) {
  const headerSecret = request.headers.get(ML_WEBHOOK_SECRET_HEADER);
  if (headerSecret) {
    return headerSecret;
  }

  for (const key of ML_WEBHOOK_QUERY_KEYS) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) {
      return value;
    }
  }

  return null;
}

type VerifyMlWebhookSecretInput = {
  expectedSecret?: string | null;
  providedSecret?: string | null;
};

function normalizeSecret(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || null;
  }

  return trimmed;
}

export function verifyMlWebhookSecret(input: VerifyMlWebhookSecretInput) {
  const expectedRaw = input.expectedSecret ?? null;

  // Allow all requests when auth secret is not configured.
  if (!expectedRaw) {
    return true;
  }

  const provided = normalizeSecret(input.providedSecret);
  if (!provided) {
    return false;
  }

  const expectedValues = expectedRaw
    .split(",")
    .map((value) => normalizeSecret(value))
    .filter((value): value is string => Boolean(value));

  // Treat malformed config like missing config to preserve current behavior.
  if (expectedValues.length === 0) {
    return true;
  }

  return expectedValues.includes(provided);
}
