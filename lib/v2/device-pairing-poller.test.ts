import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardDeviceStatus } from "./api";
import {
  removeDeviceWithConfirmation,
  startDevicePairingPoller,
} from "./device-pairing-poller";

const connectedStatus: DashboardDeviceStatus = {
  device: {
    deviceId: "device-id",
    displayName: "Shipping Computer",
    systemName: "DESKTOP-NICO",
    platform: "windows",
    agentVersion: "1.0.0",
    isPaused: false,
    online: true,
    systemBlocked: false,
    lastSeenAt: "2026-10-07T12:00:00Z",
  },
};

describe("Device pairing status polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("polls every three seconds only after pairing begins", async () => {
    const poll = vi.fn().mockResolvedValue({ device: null });
    const stop = startDevicePairingPoller({
      expiresAt: "2026-10-07T12:01:00Z",
      poll,
      onDevice: vi.fn(),
      onExpired: vi.fn(),
      onError: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(2_999);
    expect(poll).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(poll).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(poll).toHaveBeenCalledTimes(2);
    stop();
  });

  it("stops immediately when a Device appears", async () => {
    const poll = vi.fn().mockResolvedValue(connectedStatus);
    const onDevice = vi.fn();
    startDevicePairingPoller({
      expiresAt: "2026-10-07T12:01:00Z",
      poll,
      onDevice,
      onExpired: vi.fn(),
      onError: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(3_000);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(poll).toHaveBeenCalledOnce();
    expect(onDevice).toHaveBeenCalledWith(connectedStatus);
  });

  it("expires without making a late status request", async () => {
    const poll = vi.fn().mockResolvedValue({ device: null });
    const onExpired = vi.fn();
    startDevicePairingPoller({
      expiresAt: "2026-10-07T12:00:02.500Z",
      poll,
      onDevice: vi.fn(),
      onExpired,
      onError: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(2_500);

    expect(poll).not.toHaveBeenCalled();
    expect(onExpired).toHaveBeenCalledOnce();
  });

  it("cleans up its timer when pairing is cancelled or the view unmounts", async () => {
    const poll = vi.fn().mockResolvedValue({ device: null });
    const stop = startDevicePairingPoller({
      expiresAt: "2026-10-07T12:01:00Z",
      poll,
      onDevice: vi.fn(),
      onExpired: vi.fn(),
      onError: vi.fn(),
    });

    stop();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(poll).not.toHaveBeenCalled();
  });

  it("stops after a terminal status error", async () => {
    const error = new Error("Device status unavailable");
    const poll = vi.fn().mockRejectedValue(error);
    const onError = vi.fn();
    startDevicePairingPoller({
      expiresAt: "2026-10-07T12:01:00Z",
      poll,
      onDevice: vi.fn(),
      onExpired: vi.fn(),
      onError,
    });

    await vi.advanceTimersByTimeAsync(3_000);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(poll).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(error);
  });
});

describe("Device removal confirmation", () => {
  it("does not remove the Device when confirmation is declined", async () => {
    const removeDevice = vi.fn();

    await expect(
      removeDeviceWithConfirmation(() => false, removeDevice),
    ).resolves.toBe(false);
    expect(removeDevice).not.toHaveBeenCalled();
  });

  it("removes the Device after confirmation so pairing can begin again", async () => {
    const removeDevice = vi.fn().mockResolvedValue(undefined);

    await expect(
      removeDeviceWithConfirmation(() => true, removeDevice),
    ).resolves.toBe(true);
    expect(removeDevice).toHaveBeenCalledOnce();
  });
});
