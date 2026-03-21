#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function normalize(value) {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function loadEnvFile(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const content = fs.readFileSync(absolutePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1);
    if (!key) continue;
    if (!process.env[key]) process.env[key] = value;
  }
}

let envFile = ".env.local";
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--env-file=")) {
    envFile = arg.slice("--env-file=".length).trim() || envFile;
  }
}

loadEnvFile(envFile);

const APP_BASE_URL = normalize(process.env.APP_BASE_URL);
if (!APP_BASE_URL) {
  console.error("Missing APP_BASE_URL");
  process.exit(1);
}

const baseOrigin = new URL(APP_BASE_URL).origin;
const sharedEnv = { ...process.env };
if (!sharedEnv.ORDERS_CLEANUP_BASE_URL && sharedEnv.RECONCILE_BASE_URL) {
  sharedEnv.ORDERS_CLEANUP_BASE_URL = sharedEnv.RECONCILE_BASE_URL;
}
if (!sharedEnv.TELEGRAM_CONNECT_TOKENS_CLEANUP_BASE_URL && sharedEnv.ORDERS_CLEANUP_BASE_URL) {
  sharedEnv.TELEGRAM_CONNECT_TOKENS_CLEANUP_BASE_URL = sharedEnv.ORDERS_CLEANUP_BASE_URL;
}

let failed = false;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  failed = true;
  console.error(`FAIL: ${message}`);
}

function runCommand(name, cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: process.cwd(),
    env: sharedEnv,
    encoding: "utf8",
  });

  if (result.status === 0) {
    pass(`${name} succeeded`);
    return;
  }

  const stderr = normalize(result.stderr);
  const stdout = normalize(result.stdout);
  fail(`${name} failed (exit ${result.status ?? "unknown"}). ${stderr || stdout || "No output"}`);
}

async function expectStatus(name, url, init, expectedStatus, validateBody) {
  try {
    const response = await fetch(url, init);
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (response.status !== expectedStatus) {
      fail(`${name} returned HTTP ${response.status}, expected ${expectedStatus}. body=${JSON.stringify(payload)}`);
      return;
    }

    if (validateBody && !validateBody(payload, response)) {
      fail(`${name} returned expected status but payload validation failed. body=${JSON.stringify(payload)}`);
      return;
    }

    pass(`${name} returned HTTP ${expectedStatus}`);
  } catch (error) {
    fail(`${name} request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function expectRedirect(name, url, validateLocation) {
  try {
    const response = await fetch(url, { method: "GET", redirect: "manual" });
    const status = response.status;
    if (![301, 302, 303, 307, 308].includes(status)) {
      fail(`${name} expected redirect, got HTTP ${status}`);
      return;
    }

    const location = normalize(response.headers.get("location"));
    if (!location || !validateLocation(location)) {
      fail(`${name} redirect location invalid: ${location || "(empty)"}`);
      return;
    }

    pass(`${name} redirect validated`);
  } catch (error) {
    fail(`${name} request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function main() {
  console.log(`Running staging smoke pass against ${baseOrigin}`);

  runCommand("Env baseline", "npm", ["run", "security:check-env", "--", `--env-file=${envFile}`]);
  runCommand("Webhook baseline", "npm", ["run", "security:check-webhooks", "--", `--env-file=${envFile}`]);
  runCommand("Reconcile scheduler check", "bash", ["scripts/reconcile-check.sh"]);
  runCommand("Orders cleanup scheduler check", "bash", ["scripts/orders-cleanup-check.sh"]);
  if (normalize(sharedEnv.TELEGRAM_CONNECT_TOKENS_CLEANUP_CRON_SECRET)) {
    runCommand("Telegram connect token cleanup scheduler check", "bash", [
      "scripts/telegram-connect-tokens-cleanup-check.sh",
    ]);
  } else {
    console.log("SKIP: Telegram connect token cleanup scheduler check (missing TELEGRAM_CONNECT_TOKENS_CLEANUP_CRON_SECRET)");
  }

  await expectRedirect(
    "OAuth start",
    `${baseOrigin}/api/ml/oauth/start?next=/dashboard`,
    (location) => location.startsWith("https://auth.mercadolibre.com") && location.includes("state="),
  );

  await expectRedirect(
    "OAuth callback missing params",
    `${baseOrigin}/api/ml/callback`,
    (location) => location.includes("/login?error=missing_oauth_params"),
  );

  await expectStatus(
    "Billing status unauthorized gate",
    `${baseOrigin}/api/billing/status`,
    { method: "GET" },
    401,
    (payload) => payload?.error === "unauthorized",
  );

  await expectStatus(
    "Billing checkout unauthorized gate",
    `${baseOrigin}/api/billing/checkout`,
    { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
    401,
    (payload) => payload?.error === "unauthorized",
  );

  await expectStatus(
    "Telegram connect unauthorized gate",
    `${baseOrigin}/api/telegram/connect`,
    { method: "GET" },
    401,
    (payload) => payload?.error === "unauthorized",
  );

  await expectStatus(
    "Telegram disconnect unauthorized gate",
    `${baseOrigin}/api/telegram/disconnect`,
    { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
    401,
    (payload) => payload?.error === "unauthorized",
  );

  await expectStatus(
    "Telegram test unauthorized gate",
    `${baseOrigin}/api/telegram/test`,
    { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
    401,
    (payload) => payload?.error === "unauthorized",
  );

  await expectStatus(
    "Notifications test unauthorized gate",
    `${baseOrigin}/api/notifications/test`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "sale" }) },
    401,
    (payload) => payload?.error === "unauthorized",
  );

  await expectStatus(
    "ML disconnect unauthorized gate",
    `${baseOrigin}/api/ml/disconnect`,
    { method: "POST", headers: { "content-type": "application/json" }, body: "{}" },
    401,
    (payload) => payload?.error === "unauthorized",
  );

  console.log("Manual smoke checks still required: OAuth full login, paid checkout completion, Telegram real connect/test/disconnect from an authenticated session.");

  if (failed) {
    console.error("security:smoke-staging failed");
    process.exitCode = 1;
    return;
  }

  console.log("security:smoke-staging passed");
}

main().catch((error) => {
  console.error("security:smoke-staging failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
