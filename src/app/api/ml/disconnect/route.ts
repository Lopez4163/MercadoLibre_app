import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ ok: true, route: "ml-disconnect-placeholder" }, { status: 200 });
}
