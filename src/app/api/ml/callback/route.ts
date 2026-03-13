import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db/prisma";
import { exchangeAuthorizationCode, getMlUserProfile } from "../../../../../lib/ml/auth";
import { setSessionCookie } from "../../../../../lib/auth/session";
import {
  clearOAuthStateCookie,
  getOAuthStateReturnTo,
  getOAuthStateTokenFromRequest,
  isValidOAuthStatePair,
} from "../../../../../lib/auth/oauth-state";
import { normalizeNextPath } from "../../../../../lib/auth/next-path";

function getSafeBaseUrl(request: NextRequest) {
  const configured = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL;
  const origin = configured ?? request.nextUrl.origin;

  // Local Next dev server is HTTP by default, so avoid HTTPS redirects to localhost.
  if (/^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return origin.replace(/^https:/i, "http:");
  }

  return origin;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? undefined;
  const stateFromCookie = getOAuthStateTokenFromRequest(request);

  if (!code || !state) {
    const response = NextResponse.redirect(new URL("/login?error=missing_oauth_params", request.url));
    clearOAuthStateCookie(response);
    return response;
  }

  if (!isValidOAuthStatePair(state, stateFromCookie)) {
    const response = NextResponse.redirect(new URL("/login?error=invalid_oauth_state", request.url));
    clearOAuthStateCookie(response);
    return response;
  }

  try {
    const tokenData = await exchangeAuthorizationCode(code);
    const profile = await getMlUserProfile(tokenData.access_token);

    const email = profile.email ?? `${profile.id}@mercadolibre.local`;
    const mlNickname = profile.nickname ?? null;
    const tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    const user = await prisma.user.upsert({
      where: { mlUserId: String(profile.id) },
      create: {
        email,
        mlUserId: String(profile.id),
        mlNickname,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt,
      },
      update: {
        email,
        mlNickname,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt,
      },
    });

    const requestedPath = normalizeNextPath(getOAuthStateReturnTo(stateFromCookie));
    const destinationPath = requestedPath ?? "/dashboard";
    const response = NextResponse.redirect(new URL(destinationPath, getSafeBaseUrl(request)));
    setSessionCookie(response, user.id);
    clearOAuthStateCookie(response);

    return response;
  } catch (error) {
    console.error("ML OAuth callback failed:", error);
    const response = NextResponse.redirect(new URL("/login?error=oauth_failed", request.url));
    clearOAuthStateCookie(response);
    return response;
  }
}
