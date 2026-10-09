import { describe, expect, it, vi } from "vitest";

import {
  readFulfillmentPanelCollapsed,
  writeFulfillmentPanelCollapsed,
} from "./fulfillment-panel-preference";

describe("fulfillment panel preference", () => {
  it("defaults to expanded when storage is missing or corrupt", () => {
    expect(readFulfillmentPanelCollapsed(undefined)).toBe(false);
    expect(readFulfillmentPanelCollapsed({ getItem: () => "not-a-boolean", setItem: vi.fn() })).toBe(false);
  });

  it("reads and writes only the visual collapsed preference", () => {
    const setItem = vi.fn();
    const storage = { getItem: () => "true", setItem };

    expect(readFulfillmentPanelCollapsed(storage)).toBe(true);
    writeFulfillmentPanelCollapsed(storage, false);
    expect(setItem).toHaveBeenCalledWith("notiventa.fulfillmentPanelCollapsed", "false");
  });

  it("remains usable when browser storage throws", () => {
    const storage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };

    expect(readFulfillmentPanelCollapsed(storage)).toBe(false);
    expect(() => writeFulfillmentPanelCollapsed(storage, true)).not.toThrow();
  });
});
