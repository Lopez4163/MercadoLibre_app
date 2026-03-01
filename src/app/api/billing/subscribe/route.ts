import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true, route: "billing-subscribe-placeholder" }, { status: 200 });
}
