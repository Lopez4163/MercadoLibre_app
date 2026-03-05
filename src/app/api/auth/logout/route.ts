import { NextRequest, NextResponse } from "next/server";

function getRedirectBase(request: NextRequest) {
  const configured = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL;
  return configured ?? request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", getRedirectBase(request)));
  response.cookies.set("ml_user_id", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
