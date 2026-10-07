import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DashboardDevice } from "../../lib/v2/api";
import { DeviceStatusPanel } from "./DeviceStatusPanel";

const device: DashboardDevice = {
  deviceId: "device-id",
  displayName: "Shipping Computer",
  systemName: "DESKTOP-NICO",
  platform: "windows",
  agentVersion: "1.0.0",
  isPaused: false,
  online: true,
  systemBlocked: false,
  lastSeenAt: "2026-10-07T12:00:00Z",
};

describe("connected Device status", () => {
  it("renders identity, online status, and last-seen information", () => {
    const output = renderToStaticMarkup(
      <DeviceStatusPanel device={device} removing={false} onRemove={vi.fn()} />,
    );

    expect(output).toContain("Shipping Computer");
    expect(output).toContain("DESKTOP-NICO");
    expect(output).toContain("Online");
    expect(output).toContain("Last seen");
    expect(output).toContain("2026");
  });

  it("renders offline and system-blocked state", () => {
    const output = renderToStaticMarkup(
      <DeviceStatusPanel
        device={{ ...device, online: false, systemBlocked: true }}
        removing={false}
        onRemove={vi.fn()}
      />,
    );

    expect(output).toContain("Offline");
    expect(output).toContain("Needs attention");
  });
});
