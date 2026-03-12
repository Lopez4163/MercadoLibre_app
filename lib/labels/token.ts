import { createHmac, timingSafeEqual } from "node:crypto";

const ORDER_LABEL_TOKEN_VERSION = 1;
const ORDER_LABEL_TOKEN_TTL_SECONDS = 60 * 30;

type OrderLabelTokenPayload = {
  uid: string;
  oid: string;
  sid?: string;
  iat: number;
  exp: number;
  v: number;
};

type OrderLabelTokenInput = {
  userId: string;
  orderId: string;
  shipmentId?: string;
};

type OrderLabelTokenOptions = {
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

function getOrderLabelTokenSecret(override?: string) {
  const secret =
    override ??
    process.env.ORDER_LABEL_TOKEN_SECRET ??
    process.env.SESSION_SECRET ??
    process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("Missing ORDER_LABEL_TOKEN_SECRET, SESSION_SECRET, or NEXTAUTH_SECRET.");
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

function decodeOrderLabelTokenPayload(encodedPayload: string) {
  let payload: OrderLabelTokenPayload;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload)) as OrderLabelTokenPayload;
  } catch {
    return null;
  }

  if (payload.v !== ORDER_LABEL_TOKEN_VERSION) {
    return null;
  }

  if (typeof payload.uid !== "string" || typeof payload.oid !== "string") {
    return null;
  }

  if (payload.sid !== undefined && typeof payload.sid !== "string") {
    return null;
  }

  return payload;
}

export function createOrderLabelToken(input: OrderLabelTokenInput, options?: OrderLabelTokenOptions) {
  const nowMs = (options?.now ?? new Date()).getTime();
  const issuedAtSeconds = Math.floor(nowMs / 1000);
  const ttlSeconds = options?.ttlSeconds ?? ORDER_LABEL_TOKEN_TTL_SECONDS;
  const payload: OrderLabelTokenPayload = {
    uid: input.userId,
    oid: input.orderId,
    ...(input.shipmentId ? { sid: input.shipmentId } : {}),
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + ttlSeconds,
    v: ORDER_LABEL_TOKEN_VERSION,
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signPayload(encodedPayload, getOrderLabelTokenSecret(options?.secret));
  return `${encodedPayload}.${signature}`;
}

export function getOrderLabelTokenPayload(token: string | undefined, options?: OrderLabelTokenOptions) {
  if (!token) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload, getOrderLabelTokenSecret(options?.secret));
  if (!secureCompare(providedSignature, expectedSignature)) {
    return null;
  }

  const payload = decodeOrderLabelTokenPayload(encodedPayload);
  if (!payload) {
    return null;
  }

  const nowSeconds = Math.floor((options?.now ?? new Date()).getTime() / 1000);
  if (payload.exp <= nowSeconds) {
    return null;
  }

  return {
    userId: payload.uid,
    orderId: payload.oid,
    shipmentId: payload.sid ?? null,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  };
}

export function isValidOrderLabelToken(token: string | undefined, options?: OrderLabelTokenOptions) {
  return getOrderLabelTokenPayload(token, options) !== null;
}
