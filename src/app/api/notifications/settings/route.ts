import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { getSessionUserIdFromRequest } from "../../../../../lib/auth/session";

type SettingsPayload = {
  notifyEverySale?: boolean;
  notifySoldOut?: boolean;
  notifyLowStock?: boolean;
  lowStockThreshold?: number;
};

async function getSessionUser(request: NextRequest) {
  const sessionUserId = getSessionUserIdFromRequest(request);
  if (!sessionUserId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true },
  });
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const settings = await prisma.notificationSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
    },
    update: {},
    select: {
      notifyEverySale: true,
      notifySoldOut: true,
      notifyLowStock: true,
      lowStockThreshold: true,
    },
  });

  return NextResponse.json({ ok: true, settings }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let payload: SettingsPayload;
  try {
    payload = (await request.json()) as SettingsPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (
    typeof payload.notifyEverySale !== "boolean" ||
    typeof payload.notifySoldOut !== "boolean" ||
    typeof payload.notifyLowStock !== "boolean" ||
    typeof payload.lowStockThreshold !== "number" ||
    !Number.isFinite(payload.lowStockThreshold)
  ) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const lowStockThreshold = Math.max(0, Math.floor(payload.lowStockThreshold));

  const settings = await prisma.notificationSettings.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      notifyEverySale: payload.notifyEverySale,
      notifySoldOut: payload.notifySoldOut,
      notifyLowStock: payload.notifyLowStock,
      lowStockThreshold,
    },
    update: {
      notifyEverySale: payload.notifyEverySale,
      notifySoldOut: payload.notifySoldOut,
      notifyLowStock: payload.notifyLowStock,
      lowStockThreshold,
    },
    select: {
      notifyEverySale: true,
      notifySoldOut: true,
      notifyLowStock: true,
      lowStockThreshold: true,
    },
  });

  return NextResponse.json({ ok: true, settings }, { status: 200 });
}
