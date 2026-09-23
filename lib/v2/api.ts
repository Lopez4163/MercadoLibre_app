export type V2CurrentUser = {
  id: string;
  email: string;
  name: string | null;
};

export type MercadoLibreAuthorization = {
  authorizationUrl: string;
};

export class V2ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "V2ApiError";
  }
}

function apiBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_NOTIVENTA_API_URL?.trim();
  if (!configuredUrl) {
    throw new Error("NEXT_PUBLIC_NOTIVENTA_API_URL is not configured");
  }
  return configuredUrl.replace(/\/$/, "");
}

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  if (!token) {
    throw new Error("A Clerk session token is required");
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new V2ApiError(`NotiVenta API request failed (${response.status})`, response.status);
  }

  return (await response.json()) as T;
}

export function getCurrentUser(token: string): Promise<V2CurrentUser> {
  return request<V2CurrentUser>("/api/v1/me", token);
}

export function startMercadoLibreAuthorization(
  token: string,
): Promise<MercadoLibreAuthorization> {
  return request<MercadoLibreAuthorization>(
    "/api/v1/mercado-libre/oauth/authorize",
    token,
    { method: "POST" },
  );
}
