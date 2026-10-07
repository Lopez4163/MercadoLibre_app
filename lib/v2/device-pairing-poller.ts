import type { DashboardDeviceStatus } from "./api";

interface PairingPollerOptions {
  expiresAt: string;
  poll: () => Promise<DashboardDeviceStatus>;
  onDevice: (status: DashboardDeviceStatus) => void;
  onExpired: () => void;
  onError: (error: unknown) => void;
  intervalMs?: number;
  now?: () => number;
}

export function startDevicePairingPoller({
  expiresAt,
  poll,
  onDevice,
  onExpired,
  onError,
  intervalMs = 3_000,
  now = Date.now,
}: PairingPollerOptions): () => void {
  const expiresAtMs = Date.parse(expiresAt);
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function stop() {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
  }

  function scheduleNext() {
    if (stopped) return;
    const remainingMs = expiresAtMs - now();
    if (!Number.isFinite(expiresAtMs) || remainingMs <= 0) {
      stop();
      onExpired();
      return;
    }
    timer = setTimeout(() => void checkStatus(), Math.min(intervalMs, remainingMs));
  }

  async function checkStatus() {
    if (stopped) return;
    if (now() >= expiresAtMs) {
      stop();
      onExpired();
      return;
    }

    try {
      const status = await poll();
      if (stopped) return;
      if (status.device) {
        stop();
        onDevice(status);
        return;
      }
      scheduleNext();
    } catch (error) {
      if (stopped) return;
      stop();
      onError(error);
    }
  }

  scheduleNext();
  return stop;
}

export async function removeDeviceWithConfirmation(
  confirmRemoval: () => boolean,
  removeDevice: () => Promise<void>,
): Promise<boolean> {
  if (!confirmRemoval()) return false;
  await removeDevice();
  return true;
}
