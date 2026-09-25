import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const SESSION_COOKIE_NAME = "ml_session";
const SESSION_VERSION = 1;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  uid: string;
  iat: number;
  exp: number;
  v: number;
};

type SessionCookieStore = {
  get: (name: string) => { value: string } | undefined;
};

type SessionOptions = {
  secret?: string;
  now?: Date;
  ttlSeconds?: number;
};

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSessionSecret(override?: string) {
  const secret = override ?? process.env.SESSION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_SECRET or NEXTAUTH_SECRET for session signing.");
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

export function createSessionToken(userId: string, options?: SessionOptions) {
  const nowMs = (options?.now ?? new Date()).getTime();
  const issuedAtSeconds = Math.floor(nowMs / 1000);
  const ttlSeconds = options?.ttlSeconds ?? SESSION_TTL_SECONDS;
  const payload: SessionPayload = {
    uid: userId,
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + ttlSeconds,
    v: SESSION_VERSION,
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, getSessionSecret(options?.secret));
  return `${encodedPayload}.${signature}`;
}

export function getSessionUserId(token: string | undefined, options?: SessionOptions): string | null {
  if (!token) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload, getSessionSecret(options?.secret));
  if (!secureCompare(providedSignature, expectedSignature)) {
    return null;
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload)) as SessionPayload;
  } catch {
    return null;
  }

  if (payload.v !== SESSION_VERSION || typeof payload.uid !== "string") {
    return null;
  }

  const nowSeconds = Math.floor((options?.now ?? new Date()).getTime() / 1000);
  if (payload.exp <= nowSeconds) {
    return null;
  }

  return payload.uid;
}

export function setSessionCookie(response: NextResponse, userId: string, options?: SessionOptions) {
  const token = createSessionToken(userId, options);
  const ttl = options?.ttlSeconds ?? SESSION_TTL_SECONDS;

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ttl,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  // Cleanup legacy unsiged cookie for users with older sessions.
  response.cookies.set("ml_user_id", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function getSessionUserIdFromCookieStore(cookieStore: SessionCookieStore, options?: SessionOptions) {
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getSessionUserId(token, options);
}

export function getSessionUserIdFromRequest(request: NextRequest, options?: SessionOptions) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return getSessionUserId(token, options);
}
