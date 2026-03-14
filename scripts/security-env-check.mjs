#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const REQUIRED = [
  { name: "ML_WEBHOOK_SECRET", group: "Mercado Libre" },
  { name: "TELEGRAM_BOT_TOKEN", group: "Telegram" },
  { name: "TELEGRAM_BOT_USERNAME", group: "Telegram" },
  { name: "TELEGRAM_WEBHOOK_SECRET", group: "Telegram" },
  { name: "STRIPE_SECRET_KEY", group: "Stripe" },
  { name: "STRIPE_PRICE_ID", group: "Stripe" },
  { name: "STRIPE_WEBHOOK_SECRET", group: "Stripe" },
  { name: "UPSTASH_REDIS_REST_URL", group: "Redis" },
  { name: "UPSTASH_REDIS_REST_TOKEN", group: "Redis" },
];

const REQUIRED_ANY = [
  { names: ["ML_CLIENT_ID", "NEXT_PUBLIC_ML_CLIENT_ID"], group: "Mercado Libre", label: "ML client id" },
  { names: ["ML_CLIENT_SECRET", "NEXT_ML_CLIENT_SECRET"], group: "Mercado Libre", label: "ML client secret" },
  { names: ["ML_REDIRECT_URI", "NEXT_PUBLIC_ML_REDIRECT_URL"], group: "Mercado Libre", label: "ML redirect URI" },
];

const OPTIONAL_BUT_RECOMMENDED = [
  { name: "OAUTH_STATE_SECRET", group: "Session/OAuth" },
  { name: "RECONCILE_CRON_SECRET", group: "Schedulers" },
  { name: "ORDERS_CLEANUP_CRON_SECRET", group: "Schedulers" },
];

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

function normalize(value) {
  if (!value) {
    return "";
  }

  const trimmed = value.trim();
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

function hasValue(name) {
  return normalize(process.env[name]).length > 0;
}

function isWeakSecret(value) {
  const normalized = normalize(value);
  return normalized.length > 0 && normalized.length < 24;
}

const missing = REQUIRED.filter((entry) => !hasValue(entry.name));
const missingAny = REQUIRED_ANY.filter((entry) => entry.names.every((name) => !hasValue(name)));

const hasSessionSecret = hasValue("SESSION_SECRET") || hasValue("NEXTAUTH_SECRET");

const weak = [
  ...REQUIRED.filter((entry) => isWeakSecret(process.env[entry.name])),
  ...(hasValue("SESSION_SECRET") && isWeakSecret(process.env.SESSION_SECRET)
    ? [{ name: "SESSION_SECRET", group: "Session/OAuth" }]
    : []),
  ...(hasValue("NEXTAUTH_SECRET") && isWeakSecret(process.env.NEXTAUTH_SECRET)
    ? [{ name: "NEXTAUTH_SECRET", group: "Session/OAuth" }]
    : []),
];

const recommendedMissing = OPTIONAL_BUT_RECOMMENDED.filter((entry) => !hasValue(entry.name));
const legacyMlVarsUsed = [
  hasValue("NEXT_PUBLIC_ML_CLIENT_ID") && !hasValue("ML_CLIENT_ID") ? "NEXT_PUBLIC_ML_CLIENT_ID" : null,
  hasValue("NEXT_ML_CLIENT_SECRET") && !hasValue("ML_CLIENT_SECRET") ? "NEXT_ML_CLIENT_SECRET" : null,
  hasValue("NEXT_PUBLIC_ML_REDIRECT_URL") && !hasValue("ML_REDIRECT_URI") ? "NEXT_PUBLIC_ML_REDIRECT_URL" : null,
].filter(Boolean);

if (missing.length === 0 && missingAny.length === 0 && hasSessionSecret && weak.length === 0) {
  console.log("security:check-env passed");
} else {
  console.error("security:check-env failed");

  if (missing.length > 0) {
    console.error("\nMissing required variables:");
    for (const entry of missing) {
      console.error(`- [${entry.group}] ${entry.name}`);
    }
  }

  if (missingAny.length > 0) {
    console.error("\nMissing one-of required variables:");
    for (const entry of missingAny) {
      console.error(`- [${entry.group}] ${entry.label}: set one of ${entry.names.join(", ")}`);
    }
  }

  if (!hasSessionSecret) {
    console.error("\nMissing session secret: set SESSION_SECRET (preferred) or NEXTAUTH_SECRET.");
  }

  if (weak.length > 0) {
    console.error("\nWeak secrets detected (minimum recommended length: 24 chars):");
    for (const entry of weak) {
      console.error(`- [${entry.group}] ${entry.name}`);
    }
  }

  process.exitCode = 1;
}

if (recommendedMissing.length > 0) {
  console.warn("\nRecommended variables not set yet:");
  for (const entry of recommendedMissing) {
    console.warn(`- [${entry.group}] ${entry.name}`);
  }
}

if (legacyMlVarsUsed.length > 0) {
  console.warn("\nLegacy ML env names in use (works, but prefer server-only names in production):");
  for (const name of legacyMlVarsUsed) {
    console.warn(`- ${name}`);
  }
}
