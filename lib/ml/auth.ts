type MlTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
};

type MlUserResponse = {
  id: number;
  email?: string;
  nickname?: string;
};

function getMlConfig() {
  const clientId = process.env.ML_CLIENT_ID ?? process.env.NEXT_PUBLIC_ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET ?? process.env.NEXT_ML_CLIENT_SECRET;
  const redirectUri = process.env.ML_REDIRECT_URI ?? process.env.NEXT_PUBLIC_ML_REDIRECT_URL;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Missing Mercado Libre OAuth environment variables.");
  }

  return { clientId, clientSecret, redirectUri };
}

export async function exchangeAuthorizationCode(code: string): Promise<MlTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getMlConfig();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ML token exchange failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as MlTokenResponse;
}

export async function getMlUserProfile(accessToken: string): Promise<MlUserResponse> {
  const response = await fetch("https://api.mercadolibre.com/users/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ML user profile request failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as MlUserResponse;
}
