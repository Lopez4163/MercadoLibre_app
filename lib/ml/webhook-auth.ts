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

export function verifyMlWebhookSecret(input: VerifyMlWebhookSecretInput) {
  const expected = input.expectedSecret ?? null;

  // Allow all requests when auth secret is not configured.
  if (!expected) {
    return true;
  }

  const provided = input.providedSecret ?? null;
  if (!provided) {
    return false;
  }

  return provided === expected;
}
