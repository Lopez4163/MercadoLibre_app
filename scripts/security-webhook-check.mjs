#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function normalize(value) {
  if (!value) {
    return "";
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return "";
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

function loadEnvFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const content = fs.readFileSync(absolutePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const index = line.indexOf("=");
    if (index <= 0) {
      continue;
    }

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1);
    if (!key) {
      continue;
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--env-file=")) {
    const filePath = arg.slice("--env-file=".length).trim();
    if (filePath) {
      loadEnvFile(filePath);
    }
  }
}

function required(name) {
  const value = normalize(process.env[name]);
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function parseMlSecret(raw) {
  return normalize(raw)
    .split(",")
    .map((entry) => normalize(entry))
    .find((entry) => Boolean(entry)) ?? "";
}

function ensureBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("APP_BASE_URL must be https for production webhook checks.");
  }
  return url.origin;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

let hasFailure = false;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  hasFailure = true;
  console.error(`FAIL: ${message}`);
}

async function probeEndpoint(name, url, init, expectedStatus) {
  try {
    const response = await fetch(url, init);
    if (response.status === expectedStatus) {
      pass(`${name} returned HTTP ${expectedStatus}`);
      return;
    }

    const payload = await readJson(response);
    fail(`${name} returned HTTP ${response.status} (expected ${expectedStatus}). Response: ${JSON.stringify(payload)}`);
  } catch (error) {
    fail(`${name} request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function checkTelegramProvider(expectedUrl, botToken) {
  const url = `https://api.telegram.org/bot${botToken}/getWebhookInfo`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    const payload = await readJson(response);
    if (!response.ok || !payload || payload.ok !== true || !payload.result) {
      fail(`Telegram getWebhookInfo failed: HTTP ${response.status} ${JSON.stringify(payload)}`);
      return;
    }

    const configuredUrl = normalize(payload.result.url);
    if (configuredUrl !== expectedUrl) {
      fail(`Telegram webhook URL mismatch. expected=${expectedUrl} actual=${configuredUrl || "(empty)"}`);
      return;
    }

    pass("Telegram provider webhook URL matches expected production URL");
  } catch (error) {
    fail(`Telegram provider check failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function endpointHasRequiredEvents(enabledEvents, requiredEvents) {
  if (!Array.isArray(enabledEvents)) {
    return false;
  }
  if (enabledEvents.includes("*")) {
    return true;
  }
  return requiredEvents.every((event) => enabledEvents.includes(event));
}

async function checkStripeProvider(expectedUrl, stripeSecretKey) {
  try {
    const response = await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=100", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
      },
    });

    const payload = await readJson(response);
    if (!response.ok || !payload || !Array.isArray(payload.data)) {
      fail(`Stripe webhook endpoint list failed: HTTP ${response.status} ${JSON.stringify(payload)}`);
      return;
    }

    const endpoint = payload.data.find((entry) => normalize(entry.url) === expectedUrl);
    if (!endpoint) {
      fail(`Stripe webhook endpoint not found for URL: ${expectedUrl}`);
      return;
    }

    if (normalize(endpoint.status) !== "enabled") {
      fail(`Stripe webhook endpoint is not enabled (status=${endpoint.status ?? "unknown"})`);
      return;
    }

    const requiredEvents = [
      "checkout.session.completed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed",
    ];

    if (!endpointHasRequiredEvents(endpoint.enabled_events, requiredEvents)) {
      fail(
        `Stripe webhook events missing required subscriptions/billing events. enabled_events=${JSON.stringify(endpoint.enabled_events)}`,
      );
      return;
    }

    pass("Stripe provider webhook endpoint exists, enabled, and has required events");
  } catch (error) {
    fail(`Stripe provider check failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  const baseUrl = ensureBaseUrl(required("APP_BASE_URL"));
  const telegramBotToken = required("TELEGRAM_BOT_TOKEN");
  const telegramSecret = required("TELEGRAM_WEBHOOK_SECRET");
  const stripeSecretKey = required("STRIPE_SECRET_KEY");
  const mlSecretRaw = required("ML_WEBHOOK_SECRET");
  const mlSecret = parseMlSecret(mlSecretRaw);

  if (!mlSecret) {
    throw new Error("ML_WEBHOOK_SECRET must contain at least one non-empty secret value.");
  }

  const mlWebhookUrl = `${baseUrl}/api/webhooks/mercadolibre`;
  const telegramWebhookUrl = `${baseUrl}/api/telegram/webhook`;
  const stripeWebhookUrl = `${baseUrl}/api/billing/webhook`;

  console.log(`Checking webhook providers and endpoint auth against ${baseUrl}`);

  await checkTelegramProvider(telegramWebhookUrl, telegramBotToken);
  await checkStripeProvider(stripeWebhookUrl, stripeSecretKey);

  await probeEndpoint(
    "ML webhook accepts configured secret",
    mlWebhookUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ml-webhook-secret": mlSecret,
      },
      body: "{}",
    },
    200,
  );

  await probeEndpoint(
    "ML webhook rejects wrong secret",
    mlWebhookUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ml-webhook-secret": `invalid-${Date.now()}`,
      },
      body: "{}",
    },
    403,
  );

  await probeEndpoint(
    "Telegram webhook accepts configured secret",
    telegramWebhookUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": telegramSecret,
      },
      body: "{}",
    },
    200,
  );

  await probeEndpoint(
    "Telegram webhook rejects wrong secret",
    telegramWebhookUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": `invalid-${Date.now()}`,
      },
      body: "{}",
    },
    403,
  );

  await probeEndpoint(
    "Stripe webhook enforces signature",
    stripeWebhookUrl,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{}",
    },
    400,
  );

  if (hasFailure) {
    console.error("security:check-webhooks failed");
    process.exitCode = 1;
    return;
  }

  console.log("security:check-webhooks passed");
}

main().catch((error) => {
  console.error("security:check-webhooks failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
