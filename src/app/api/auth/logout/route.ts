import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "../../../../../lib/auth/session";

function getRedirectBase(request: NextRequest) {
  const configured = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL;
  return configured ?? request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", getRedirectBase(request)));
  clearSessionCookie(response);
  return response;
}
