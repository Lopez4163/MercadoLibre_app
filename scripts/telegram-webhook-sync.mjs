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

function parseArgs(argv) {
  const parsed = {
    apply: false,
    force: false,
    allowHttp: false,
    envFile: null,
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      parsed.apply = true;
      continue;
    }

    if (arg === "--force") {
      parsed.force = true;
      continue;
    }

    if (arg === "--allow-http") {
      parsed.allowHttp = true;
      continue;
    }

    if (arg.startsWith("--env-file=")) {
      parsed.envFile = arg.slice("--env-file=".length).trim() || null;
      continue;
    }
  }

  return parsed;
}

function requiredEnv(name) {
  const value = normalize(process.env[name]);
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function buildExpectedWebhookUrl(appBaseUrl, allowHttp) {
  const parsed = new URL(appBaseUrl);
  if (!allowHttp && parsed.protocol !== "https:") {
    throw new Error("APP_BASE_URL must be https. Use --allow-http only for local/dev checks.");
  }

  return new URL("/api/telegram/webhook", parsed.origin).toString();
}

async function telegramApiRequest({ botToken, method, body }) {
  const url = `https://api.telegram.org/bot${botToken}/${method}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const raw = await response.text();
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = raw;
  }

  if (!response.ok) {
    throw new Error(`Telegram ${method} HTTP ${response.status}: ${JSON.stringify(payload)}`);
  }

  if (!payload || payload.ok !== true) {
    throw new Error(`Telegram ${method} API error: ${JSON.stringify(payload)}`);
  }

  return payload.result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.envFile) {
    loadEnvFile(args.envFile);
  }

  const appBaseUrl = requiredEnv("APP_BASE_URL");
  const botToken = requiredEnv("TELEGRAM_BOT_TOKEN");
  const webhookSecret = requiredEnv("TELEGRAM_WEBHOOK_SECRET");
  const expectedWebhookUrl = buildExpectedWebhookUrl(appBaseUrl, args.allowHttp);

  const infoBefore = await telegramApiRequest({
    botToken,
    method: "getWebhookInfo",
  });

  const currentUrl = normalize(infoBefore?.url);
  const alreadyConfigured = currentUrl === expectedWebhookUrl;

  if (!args.apply) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "check",
          expectedWebhookUrl,
          currentWebhookUrl: currentUrl || null,
          matchesExpectedUrl: alreadyConfigured,
          pendingUpdateCount: infoBefore?.pending_update_count ?? null,
          note: "No changes applied. Re-run with --apply to register/update webhook.",
        },
        null,
        2,
      ),
    );
    return;
  }

  if (alreadyConfigured && !args.force) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "apply",
          changed: false,
          expectedWebhookUrl,
          currentWebhookUrl: currentUrl || null,
          pendingUpdateCount: infoBefore?.pending_update_count ?? null,
          note: "Webhook already matches expected URL. Use --force to re-register anyway.",
        },
        null,
        2,
      ),
    );
    return;
  }

  await telegramApiRequest({
    botToken,
    method: "setWebhook",
    body: {
      url: expectedWebhookUrl,
      secret_token: webhookSecret,
      allowed_updates: ["message"],
      drop_pending_updates: false,
    },
  });

  const infoAfter = await telegramApiRequest({
    botToken,
    method: "getWebhookInfo",
  });

  const updatedUrl = normalize(infoAfter?.url);
  if (updatedUrl !== expectedWebhookUrl) {
    throw new Error(
      `Webhook registration verification failed. expected=${expectedWebhookUrl} actual=${updatedUrl || "(empty)"}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "apply",
        changed: true,
        expectedWebhookUrl,
        currentWebhookUrl: updatedUrl,
        pendingUpdateCount: infoAfter?.pending_update_count ?? null,
        note: "Webhook URL verified. Secret token was set in the same operation.",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: "telegram_webhook_sync_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
