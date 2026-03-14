import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { clearSessionCookie, getSessionUserIdFromRequest } from "../../../../../lib/auth/session";

export async function POST(request: NextRequest) {
  const sessionUserId = getSessionUserIdFromRequest(request);
  if (!sessionUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  await prisma.user.updateMany({
    where: { id: sessionUserId },
    data: {
      accessToken: "",
      refreshToken: "",
      tokenExpiresAt: new Date(0),
      mlAvatarUrl: null,
    },
  });

  const response = NextResponse.json({ ok: true }, { status: 200 });
  clearSessionCookie(response);
  return response;
}
