import {
  isLikelyTransientNetworkError,
  isRetryableHttpStatus,
  RetryableRequestError,
  withRetry,
} from "../utils/retry";

export type MlTokenResponse = {
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
  thumbnail?:
    | string
    | {
        picture_id?: string;
        picture_url?: string;
      };
  picture?: string;
  logo?: string;
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

async function fetchMlAuthWithRetry(url: string, init: RequestInit, errorPrefix: string) {
  return withRetry(
    async () => {
      const response = await fetch(url, init);
      if (response.ok) {
        return response;
      }

      const errorText = await response.text();
      const message = `${errorPrefix}: ${response.status} ${errorText}`;
      if (isRetryableHttpStatus(response.status)) {
        throw new RetryableRequestError(message);
      }

      throw new Error(message);
    },
    {
      shouldRetry: (error) =>
        error instanceof RetryableRequestError || isLikelyTransientNetworkError(error),
    },
  );
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

  const response = await fetchMlAuthWithRetry(
    "https://api.mercadolibre.com/oauth/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    },
    "ML token exchange failed",
  );

  return (await response.json()) as MlTokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<MlTokenResponse> {
  const { clientId, clientSecret } = getMlConfig();

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const response = await fetchMlAuthWithRetry(
    "https://api.mercadolibre.com/oauth/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
    },
    "ML token refresh failed",
  );

  return (await response.json()) as MlTokenResponse;
}

export async function getMlUserProfile(accessToken: string): Promise<MlUserResponse> {
  const response = await fetchMlAuthWithRetry(
    "https://api.mercadolibre.com/users/me",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
    "ML user profile request failed",
  );

  return (await response.json()) as MlUserResponse;
}
