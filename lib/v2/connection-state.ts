import type { MercadoLibreAccount } from "./api";

export type ConnectionView = "loading" | "error" | "connected" | "disconnected";
export type MercadoLibreReturnResult = "connected" | "error" | null;

export function mercadoLibreReturnResult(search: string): MercadoLibreReturnResult {
  const result = new URLSearchParams(search).get("mercadoLibre");
  return result === "connected" || result === "error" ? result : null;
}

export function connectionView(
  loading: boolean,
  error: string | null,
  account: MercadoLibreAccount | null,
): ConnectionView {
  if (loading) return "loading";
  if (error) return "error";
  if (account?.connected) return "connected";
  return "disconnected";
}
