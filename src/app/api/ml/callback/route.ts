import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      route: "ml-callback",
      message: "Mercado Libre callback test endpoint is working.",
    },
    { status: 200 }
  );
}

export async function POST() {
  return NextResponse.json(
    {
      ok: true,
      route: "ml-callback",
      message: "Mercado Libre callback test endpoint is working.",
    },
    { status: 200 }
  );
}
