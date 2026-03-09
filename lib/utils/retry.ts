export class RetryableRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryableRequestError";
  }
}

type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isRetryableHttpStatus(status: number) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

export function isLikelyTransientNetworkError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "AbortError") {
    return true;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("enotfound") ||
    message.includes("ehostunreach") ||
    message.includes("socket hang up")
  );
}

function toMillisWithExponentialBackoff(attempt: number, baseDelayMs: number, maxDelayMs: number) {
  const exponential = baseDelayMs * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(Math.random() * 100);
  return Math.min(maxDelayMs, exponential + jitter);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (isObject(error) && typeof error.message === "string") {
    return error.message;
  }

  return "unknown error";
}

export async function withRetry<T>(operation: (attempt: number) => Promise<T>, options?: RetryOptions) {
  const maxAttempts = options?.maxAttempts ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 250;
  const maxDelayMs = options?.maxDelayMs ?? 2_000;
  const shouldRetry =
    options?.shouldRetry ?? ((error: unknown) => error instanceof RetryableRequestError);

  if (maxAttempts <= 1) {
    return operation(1);
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      const canRetry = attempt < maxAttempts && shouldRetry(error, attempt);
      if (!canRetry) {
        throw error;
      }

      const delayMs = toMillisWithExponentialBackoff(attempt, baseDelayMs, maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Retry attempts exhausted: ${getErrorMessage(lastError)}`);
}
