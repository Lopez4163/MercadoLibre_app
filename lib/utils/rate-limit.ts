import { NextRequest } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type InMemoryRateLimitStore = Map<string, RateLimitBucket>;

type ConsumeRateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
  nowMs?: number;
};

export type RateLimitDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

const STORE_KEY = "__mercado_libs_rate_limit_store__";
const PRUNE_COUNTER_KEY = "__mercado_libs_rate_limit_prune_counter__";
const PRUNE_EVERY = 100;

type RedisConfig = {
  url: string;
  token: string;
};

export class RateLimitConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitConfigurationError";
  }
}

export class RateLimitUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitUnavailableError";
  }
}

function getStore() {
  const globalWithStore = globalThis as typeof globalThis & {
    [STORE_KEY]?: InMemoryRateLimitStore;
  };

  if (!globalWithStore[STORE_KEY]) {
    globalWithStore[STORE_KEY] = new Map<string, RateLimitBucket>();
  }

  return globalWithStore[STORE_KEY];
}

function maybePruneExpired(nowMs: number) {
  const globalWithCounter = globalThis as typeof globalThis & {
    [PRUNE_COUNTER_KEY]?: number;
  };
  const currentCount = (globalWithCounter[PRUNE_COUNTER_KEY] ?? 0) + 1;
  globalWithCounter[PRUNE_COUNTER_KEY] = currentCount;

  if (currentCount % PRUNE_EVERY !== 0) {
    return;
  }

  const store = getStore();
  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= nowMs) {
      store.delete(key);
    }
  }
}

function consumeRateLimitInMemory(input: ConsumeRateLimitInput): RateLimitDecision {
  const nowMs = input.nowMs ?? Date.now();
  const safeLimit = Math.max(1, Math.floor(input.limit));
  const safeWindowMs = Math.max(1000, Math.floor(input.windowMs));
  const store = getStore();

  maybePruneExpired(nowMs);

  const existing = store.get(input.key);
  if (!existing || existing.resetAt <= nowMs) {
    const resetAt = nowMs + safeWindowMs;
    store.set(input.key, { count: 1, resetAt });
    return {
      allowed: true,
      limit: safeLimit,
      remaining: Math.max(0, safeLimit - 1),
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  const updatedCount = existing.count + 1;
  const decision: RateLimitDecision = {
    allowed: updatedCount <= safeLimit,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - updatedCount),
    resetAt: existing.resetAt,
    retryAfterSeconds: 0,
  };

  if (!decision.allowed) {
    decision.retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - nowMs) / 1000));
  }

  store.set(input.key, { count: updatedCount, resetAt: existing.resetAt });
  return decision;
}

function getRedisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

function isStrictProductionRateLimitMode() {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  return process.env.RATE_LIMIT_STRICT_MODE !== "false";
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

async function runRedisCommand<T>(config: RedisConfig, command: string[]): Promise<T> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`redis_command_failed_${response.status}`);
  }

  const json = (await response.json()) as { result?: T };
  if (!("result" in json)) {
    throw new Error("redis_result_missing");
  }

  return json.result as T;
}

async function consumeRateLimitInRedis(input: ConsumeRateLimitInput, config: RedisConfig): Promise<RateLimitDecision> {
  const nowMs = input.nowMs ?? Date.now();
  const safeLimit = Math.max(1, Math.floor(input.limit));
  const safeWindowMs = Math.max(1000, Math.floor(input.windowMs));
  const windowSeconds = Math.ceil(safeWindowMs / 1000);

  const incrementResult = await runRedisCommand<unknown>(config, ["INCR", input.key]);
  const count = toNumber(incrementResult);
  if (count === null) {
    throw new Error("redis_incr_invalid");
  }

  if (count === 1) {
    await runRedisCommand<unknown>(config, ["EXPIRE", input.key, String(windowSeconds)]);
  }

  const ttlResult = await runRedisCommand<unknown>(config, ["TTL", input.key]);
  const ttlSecondsRaw = toNumber(ttlResult);
  const ttlSeconds = ttlSecondsRaw !== null && ttlSecondsRaw > 0 ? ttlSecondsRaw : windowSeconds;
  const resetAt = nowMs + ttlSeconds * 1000;
  const allowed = count <= safeLimit;

  return {
    allowed,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - count),
    resetAt,
    retryAfterSeconds: allowed ? 0 : Math.max(1, ttlSeconds),
  };
}

export async function consumeRateLimit(input: ConsumeRateLimitInput): Promise<RateLimitDecision> {
  const redisConfig = getRedisConfig();
  if (!redisConfig) {
    if (isStrictProductionRateLimitMode()) {
      throw new RateLimitConfigurationError(
        "Redis is required for rate limiting in production. Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      );
    }

    return consumeRateLimitInMemory(input);
  }

  try {
    return await consumeRateLimitInRedis(input, redisConfig);
  } catch (error) {
    if (isStrictProductionRateLimitMode()) {
      throw new RateLimitUnavailableError("Redis-backed rate limiting is unavailable in production.");
    }

    console.error("[rate-limit] redis unavailable, falling back to memory", error);
    return consumeRateLimitInMemory(input);
  }
}

export function buildRateLimitKey(scope: string, userId: string, ip: string) {
  return `${scope}:${userId}:${ip}`;
}

export function getRequestIp(request: NextRequest) {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) {
    return xRealIp;
  }

  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return "unknown";
}

export function buildRateLimitHeaders(decision: RateLimitDecision) {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(decision.remaining),
    "X-RateLimit-Reset": String(Math.floor(decision.resetAt / 1000)),
  };

  if (!decision.allowed && decision.retryAfterSeconds > 0) {
    headers["Retry-After"] = String(decision.retryAfterSeconds);
  }

  return headers;
}
