const FULFILLMENT_PANEL_COLLAPSED_KEY = "notiventa.fulfillmentPanelCollapsed";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function readFulfillmentPanelCollapsed(storage: StorageLike | null | undefined): boolean {
  try {
    return storage?.getItem(FULFILLMENT_PANEL_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeFulfillmentPanelCollapsed(
  storage: StorageLike | null | undefined,
  collapsed: boolean,
) {
  try {
    storage?.setItem(FULFILLMENT_PANEL_COLLAPSED_KEY, String(collapsed));
  } catch {
    // The layout remains usable when browser storage is unavailable.
  }
}
