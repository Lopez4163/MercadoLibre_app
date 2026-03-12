import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const OAUTH_STATE_COOKIE_NAME = "ml_oauth_state";
const OAUTH_STATE_VERSION = 1;
const OAUTH_STATE_TTL_SECONDS = 60 * 10;

type OAuthStatePayload = {
  n: string;
  r?: string;
  iat: number;
  exp: number;
  v: number;
};

type OAuthStateOptions = {
  secret?: string;
  now?: Date;
  ttlSeconds?: number;
  returnTo?: string;
};

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getOAuthStateSecret(override?: string) {
  const secret = override ?? process.env.OAUTH_STATE_SECRET ?? process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("Missing OAUTH_STATE_SECRET, SESSION_SECRET, or NEXTAUTH_SECRET.");
  }
  return secret;
}

function signPayload(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function secureCompare(a: string, b: string) {
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

export function createOAuthStateToken(options?: OAuthStateOptions) {
  const nowMs = (options?.now ?? new Date()).getTime();
  const issuedAtSeconds = Math.floor(nowMs / 1000);
  const ttlSeconds = options?.ttlSeconds ?? OAUTH_STATE_TTL_SECONDS;
  const payload: OAuthStatePayload = {
    n: randomBytes(24).toString("base64url"),
    ...(options?.returnTo ? { r: options.returnTo } : {}),
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + ttlSeconds,
    v: OAUTH_STATE_VERSION,
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, getOAuthStateSecret(options?.secret));
  return `${encodedPayload}.${signature}`;
}

export function isValidOAuthStateToken(token: string | undefined, options?: OAuthStateOptions) {
  if (!token) {
    return false;
  }

  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    return false;
  }

  const expectedSignature = signPayload(encodedPayload, getOAuthStateSecret(options?.secret));
  if (!secureCompare(providedSignature, expectedSignature)) {
    return false;
  }

  const payload = decodeOAuthStatePayload(encodedPayload);
  if (!payload) {
    return false;
  }

  const nowSeconds = Math.floor((options?.now ?? new Date()).getTime() / 1000);
  return payload.exp > nowSeconds;
}

export function isValidOAuthStatePair(
  stateFromQuery: string | undefined,
  stateFromCookie: string | undefined,
  options?: OAuthStateOptions,
) {
  if (!stateFromQuery || !stateFromCookie) {
    return false;
  }

  if (!secureCompare(stateFromQuery, stateFromCookie)) {
    return false;
  }

  return isValidOAuthStateToken(stateFromQuery, options);
}

export function setOAuthStateCookie(response: NextResponse, stateToken: string, options?: OAuthStateOptions) {
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, stateToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: options?.ttlSeconds ?? OAUTH_STATE_TTL_SECONDS,
  });
}

export function clearOAuthStateCookie(response: NextResponse) {
  response.cookies.set(OAUTH_STATE_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function getOAuthStateTokenFromRequest(request: NextRequest) {
  return request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;
}

function decodeOAuthStatePayload(encodedPayload: string): OAuthStatePayload | null {
  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload)) as OAuthStatePayload;
  } catch {
    return null;
  }

  if (payload.v !== OAUTH_STATE_VERSION || typeof payload.n !== "string") {
    return null;
  }

  if (payload.r !== undefined && typeof payload.r !== "string") {
    return null;
  }

  return payload;
}

export function getOAuthStateReturnTo(token: string | undefined, options?: OAuthStateOptions) {
  if (!isValidOAuthStateToken(token, options) || !token) {
    return null;
  }

  const [encodedPayload] = token.split(".");
  if (!encodedPayload) {
    return null;
  }

  const payload = decodeOAuthStatePayload(encodedPayload);
  return payload?.r ?? null;
}
