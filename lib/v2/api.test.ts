import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getMercadoLibreAccount,
  getCurrentUser,
  startMercadoLibreAuthorization,
  V2ApiError,
} from "./api";

describe("V2 FastAPI client", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_NOTIVENTA_API_URL", "https://api.example.test/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("calls /me with the Clerk bearer token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-id", email: "user@example.com", name: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(getCurrentUser("session-token")).resolves.toEqual({
      id: "user-id",
      email: "user@example.com",
      name: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/me",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer session-token" }),
      }),
    );
  });

  it("starts the backend-owned Mercado Libre authorization flow", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ authorizationUrl: "https://auth.example.test/start" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(startMercadoLibreAuthorization("session-token")).resolves.toEqual({
      authorizationUrl: "https://auth.example.test/start",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/mercado-libre/oauth/authorize",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("loads the authenticated user's Mercado Libre connection state", async () => {
    const payload = {
      connected: true,
      accountId: "account-id",
      externalSellerId: "seller-id",
    };
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await expect(getMercadoLibreAccount("session-token")).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/mercado-libre/account",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer session-token" }),
      }),
    );
  });

  it("reports API failures without including the session token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 401 }));

    const request = getCurrentUser("sensitive-session-token");
    await expect(request).rejects.toBeInstanceOf(V2ApiError);
    await expect(request).rejects.not.toThrow(/sensitive-session-token/);
  });
});
