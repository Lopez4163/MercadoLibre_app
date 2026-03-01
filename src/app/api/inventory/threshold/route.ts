import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true, route: "inventory-threshold-placeholder" }, { status: 200 });
}
