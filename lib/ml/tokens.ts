import { prisma } from "../db/prisma";
import { refreshAccessToken } from "./auth";

type MlUserTokenContext = {
  id: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
};

function isMlUnauthorizedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes(" 401") || message.includes("unauthorized") || message.includes("invalid access token");
}

async function refreshAndPersistTokens(userId: string, refreshToken: string) {
  const refreshed = await refreshAccessToken(refreshToken);
  const tokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);

  await prisma.user.update({
    where: { id: userId },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      tokenExpiresAt,
    },
  });

  return {
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    tokenExpiresAt,
  };
}

export async function withUserMlAccessToken<T>(
  user: MlUserTokenContext,
  operation: (accessToken: string) => Promise<T>,
): Promise<T> {
  let accessToken = user.accessToken;
  let refreshToken = user.refreshToken;
  let tokenExpiresAt = user.tokenExpiresAt;

  // Refresh slightly early to reduce mid-request expirations.
  if (tokenExpiresAt.getTime() <= Date.now() + 60_000) {
    const refreshed = await refreshAndPersistTokens(user.id, refreshToken);
    accessToken = refreshed.accessToken;
    refreshToken = refreshed.refreshToken;
    tokenExpiresAt = refreshed.tokenExpiresAt;
  }

  try {
    return await operation(accessToken);
  } catch (error) {
    if (!isMlUnauthorizedError(error)) {
      throw error;
    }

    const refreshed = await refreshAndPersistTokens(user.id, refreshToken);
    accessToken = refreshed.accessToken;
    tokenExpiresAt = refreshed.tokenExpiresAt;

    return operation(accessToken);
  }
}
