export const FULFILLMENT_QUEUE_REFRESH_INTERVAL_MS = 15_000;

export function canRefreshFulfillmentQueue(visibilityState: string): boolean {
  return visibilityState === "visible";
}
