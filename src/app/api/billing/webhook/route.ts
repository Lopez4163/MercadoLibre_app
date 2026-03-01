import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true, route: "billing-webhook-placeholder" }, { status: 200 });
}
