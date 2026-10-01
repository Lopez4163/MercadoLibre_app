import { describe, expect, it } from "vitest";

import { connectionView, mercadoLibreReturnResult } from "./connection-state";

describe("V2 Mercado Libre connection view", () => {
  it("shows loading while identity and account state are being fetched", () => {
    expect(connectionView(true, null, null)).toBe("loading");
  });

  it("shows disconnected and allows the connect action when no account exists", () => {
    expect(
      connectionView(false, null, {
        connected: false,
        accountId: null,
        externalSellerId: null,
      }),
    ).toBe("disconnected");
  });

  it("shows connected so the connect action is hidden", () => {
    expect(
      connectionView(false, null, {
        connected: true,
        accountId: "account-id",
        externalSellerId: "seller-id",
      }),
    ).toBe("connected");
  });

  it("shows API errors separately from connection state", () => {
    expect(connectionView(false, "API unavailable", null)).toBe("error");
  });

  it("recognizes safe OAuth return markers that trigger a status refresh", () => {
    expect(mercadoLibreReturnResult("?mercadoLibre=connected&code=ignored")).toBe(
      "connected",
    );
    expect(mercadoLibreReturnResult("?mercadoLibre=error")).toBe("error");
    expect(mercadoLibreReturnResult("?mercadoLibre=https://attacker.example")).toBeNull();
  });
});
