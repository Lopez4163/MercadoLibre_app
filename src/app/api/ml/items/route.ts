import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { getItemsByIds, getSellerItemIds } from "../../../../../lib/ml/api";

export async function GET(request: NextRequest) {
  console.log('** HIT ** ')
  const sessionUserId = request.cookies.get("ml_user_id")?.value;
  console.log('** GRABING SESSIONUSERID **',sessionUserId)
  if (!sessionUserId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: {
      id: true,
      mlUserId: true,
      accessToken: true,
    },
  });
  console.log(' ** USER **', user)
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const statusParam = request.nextUrl.searchParams.get("status") ?? "active";
  console.log(' ** STATUS PARAMS **', statusParam)

  try {
    const itemIds = await getSellerItemIds({
      accessToken: user.accessToken,
      mlUserId: user.mlUserId,
      status: statusParam,
    });

    const items = await getItemsByIds({ accessToken: user.accessToken, itemIds });

    return NextResponse.json(
      {
        ok: true,
        seller: user.mlUserId,
        status: statusParam,
        count: items.length,
        items,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      { ok: false, error: "ml_items_fetch_failed", message },
      { status: 502 }
    );
  }
}
