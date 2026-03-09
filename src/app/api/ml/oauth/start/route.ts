import { NextRequest, NextResponse } from "next/server";
import { createOAuthStateToken, setOAuthStateCookie } from "../../../../../../lib/auth/oauth-state";

const ML_AUTH_URL = "https://auth.mercadolibre.com.co/authorization";
const ML_SCOPE = "read_listings read_orders offline_access write_listings";

function getMlClientId() {
  return process.env.ML_CLIENT_ID ?? process.env.NEXT_PUBLIC_ML_CLIENT_ID;
}

function getMlRedirectUri(request: NextRequest) {
  return process.env.ML_REDIRECT_URI ?? process.env.NEXT_PUBLIC_ML_REDIRECT_URL ?? `${request.nextUrl.origin}/api/ml/callback`;
}

export async function GET(request: NextRequest) {
  const clientId = getMlClientId();
  const redirectUri = getMlRedirectUri(request);

  if (!clientId || !redirectUri) {
    return NextResponse.redirect(new URL("/login?error=oauth_config_missing", request.url));
  }

  const state = createOAuthStateToken();
  const authUrl = new URL(ML_AUTH_URL);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", ML_SCOPE);
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl);
  setOAuthStateCookie(response, state);
  return response;
}
