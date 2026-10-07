"use client";

import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

import {
  createDevicePairingCode,
  getDashboardDevice,
  getMercadoLibreAccount,
  getCurrentUser,
  removeDashboardDevice,
  startMercadoLibreAuthorization,
  type DashboardDevice,
  type MercadoLibreAccount,
  type V2CurrentUser,
} from "../../lib/v2/api";
import {
  connectionView,
  mercadoLibreReturnResult,
} from "../../lib/v2/connection-state";
import {
  removeDeviceWithConfirmation,
  startDevicePairingPoller,
} from "../../lib/v2/device-pairing-poller";
import { DeviceStatusPanel } from "./DeviceStatusPanel";

type PairingStatus = "idle" | "active" | "expired" | "error";

function SignedInConnectionPanel() {
  const { getToken } = useAuth();
  const [user, setUser] = useState<V2CurrentUser | null>(null);
  const [account, setAccount] = useState<MercadoLibreAccount | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [creatingPairingCode, setCreatingPairingCode] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingCodeExpiresAt, setPairingCodeExpiresAt] = useState<string | null>(null);
  const [pairingStatus, setPairingStatus] = useState<PairingStatus>("idle");
  const [device, setDevice] = useState<DashboardDevice | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [removingDevice, setRemovingDevice] = useState(false);
  const [tokenCopyStatus, setTokenCopyStatus] = useState<string | null>(null);

  const testToolsEnabled =
    process.env.NEXT_PUBLIC_NOTIVENTA_ENABLE_TEST_TOOLS === "true";

  const loadState = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("No active Clerk session is available");
      const [currentUser, mercadoLibreAccount, deviceStatus] = await Promise.all([
        getCurrentUser(token),
        getMercadoLibreAccount(token),
        getDashboardDevice(token),
      ]);
      setUser(currentUser);
      setAccount(mercadoLibreAccount);
      setDevice(deviceStatus.device);
    } catch (caught) {
      setApiError(
        caught instanceof Error
          ? caught.message
          : "Unable to load your NotiVenta connection state",
      );
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (pairingStatus !== "active" || !pairingCodeExpiresAt || device) return;

    return startDevicePairingPoller({
      expiresAt: pairingCodeExpiresAt,
      poll: async () => {
        const token = await getToken();
        if (!token) throw new Error("No active Clerk session is available");
        return getDashboardDevice(token);
      },
      onDevice: ({ device: connectedDevice }) => {
        setDevice(connectedDevice);
        setPairingCode(null);
        setPairingCodeExpiresAt(null);
        setPairingStatus("idle");
        setDeviceError(null);
      },
      onExpired: () => setPairingStatus("expired"),
      onError: (caught) => {
        setPairingStatus("error");
        setDeviceError(
          caught instanceof Error
            ? caught.message
            : "Unable to check the Device pairing status",
        );
      },
    });
  }, [device, getToken, pairingCodeExpiresAt, pairingStatus]);

  useEffect(() => {
    const result = mercadoLibreReturnResult(window.location.search);
    if (result === "connected") {
      setOauthMessage("Mercado Libre was connected successfully.");
    } else if (result === "error") {
      setOauthMessage("Mercado Libre could not be connected. You can try again.");
    }
    if (result === "connected" || result === "error") {
      window.history.replaceState({}, "", window.location.pathname);
    }
    void loadState();
  }, [loadState]);

  async function connectMercadoLibre() {
    setConnecting(true);
    setApiError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("No active Clerk session is available");
      const { authorizationUrl } = await startMercadoLibreAuthorization(token);
      window.location.assign(authorizationUrl);
    } catch (caught) {
      setApiError(
        caught instanceof Error
          ? caught.message
          : "Unable to start Mercado Libre authorization",
      );
      setConnecting(false);
    }
  }

  async function generatePairingCode() {
    setCreatingPairingCode(true);
    setApiError(null);
    setPairingCode(null);
    setPairingCodeExpiresAt(null);
    setPairingStatus("idle");
    setDeviceError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("No active Clerk session is available");
      const result = await createDevicePairingCode(token);
      setPairingCode(result.code);
      setPairingCodeExpiresAt(result.expiresAt);
      setPairingStatus("active");
    } catch (caught) {
      setApiError(
        caught instanceof Error
          ? caught.message
          : "Unable to create a Device pairing code",
      );
    } finally {
      setCreatingPairingCode(false);
    }
  }

  function cancelPairing() {
    setPairingCode(null);
    setPairingCodeExpiresAt(null);
    setPairingStatus("idle");
    setDeviceError(null);
  }

  async function disconnectDevice() {
    if (!device) return;
    setDeviceError(null);
    try {
      const removed = await removeDeviceWithConfirmation(
        () => window.confirm(`Disconnect ${device.displayName}?`),
        async () => {
          setRemovingDevice(true);
          const token = await getToken();
          if (!token) throw new Error("No active Clerk session is available");
          await removeDashboardDevice(token, device.deviceId);
        },
      );
      if (removed) {
        setDevice(null);
        setPairingCode(null);
        setPairingCodeExpiresAt(null);
        setPairingStatus("idle");
      }
    } catch (caught) {
      setDeviceError(
        caught instanceof Error
          ? caught.message
          : "Unable to disconnect the computer",
      );
    } finally {
      setRemovingDevice(false);
    }
  }

  async function copyBearerToken() {
    setTokenCopyStatus(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("No active Clerk session is available");
      await navigator.clipboard.writeText(token);
      setTokenCopyStatus("Bearer token copied. Treat it as a temporary secret.");
    } catch {
      setTokenCopyStatus("Unable to copy the bearer token.");
    }
  }

  const view = connectionView(loading, apiError, account);

  return (
    <section className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-zinc-500">NotiVenta V2</p>
          <h1 className="text-3xl font-semibold">Connect Mercado Libre</h1>
        </div>
        <UserButton />
      </header>

      <div className="rounded-xl border border-zinc-300 p-5 dark:border-zinc-700">
        <h2 className="mb-3 text-lg font-medium">Authenticated NotiVenta user</h2>
        {loading && <p>Loading your NotiVenta account…</p>}
        {!loading && user && (
          <dl className="grid gap-2 text-sm">
            <div><dt className="font-medium">Internal ID</dt><dd className="break-all">{user.id}</dd></div>
            <div><dt className="font-medium">Email</dt><dd>{user.email}</dd></div>
            <div><dt className="font-medium">Name</dt><dd>{user.name ?? "Not provided"}</dd></div>
          </dl>
        )}
        {!loading && (
          <button className="mt-4 underline" onClick={() => void loadState()} type="button">
            Refresh connection status
          </button>
        )}
      </div>

      {view === "loading" && <p>Checking your Mercado Libre connection…</p>}

      {view === "disconnected" && (
        <div className="rounded-xl border border-zinc-300 p-5 dark:border-zinc-700">
          <h2 className="text-xl font-semibold">Connect your Mercado Libre seller account</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Authorize NotiVenta once to process eligible shipment notifications.
          </p>
          <button
            className="mt-5 rounded-lg bg-yellow-400 px-5 py-3 font-semibold text-black disabled:opacity-50"
            disabled={!user || connecting}
            onClick={() => void connectMercadoLibre()}
            type="button"
          >
            {connecting ? "Opening Mercado Libre…" : "Connect Mercado Libre"}
          </button>
        </div>
      )}

      {view === "connected" && account?.connected && (
        <>
          <div className="rounded-xl border border-emerald-500 bg-emerald-50 p-5 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50">
            <h2 className="text-xl font-semibold">Mercado Libre connected</h2>
            <p className="mt-2 text-sm">Seller ID: {account.externalSellerId}</p>
            <p className="mt-1 text-sm">NotiVenta will keep this connection securely on the backend.</p>
          </div>

          {device ? (
            <DeviceStatusPanel
              device={device}
              removing={removingDevice}
              onRemove={() => void disconnectDevice()}
            />
          ) : (
            <div className="rounded-xl border border-zinc-300 p-5 dark:border-zinc-700">
              <h2 className="text-xl font-semibold">Connect computer</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Generate a six-digit code, then enter it in the NotiVenta Agent.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="rounded-lg bg-black px-4 py-2 font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black"
                  disabled={creatingPairingCode || pairingStatus === "active"}
                  onClick={() => void generatePairingCode()}
                  type="button"
                >
                  {creatingPairingCode ? "Generating…" : "Generate pairing code"}
                </button>
                {pairingStatus === "active" && (
                  <button
                    className="rounded-lg border border-zinc-500 px-4 py-2 font-semibold"
                    onClick={cancelPairing}
                    type="button"
                  >
                    Cancel
                  </button>
                )}
              </div>
              {pairingCode && (
                <div className="mt-5" role="status">
                  <p className="text-sm font-medium">Pairing code</p>
                  <p className="mt-1 font-mono text-3xl font-bold tracking-[0.35em]">{pairingCode}</p>
                  {pairingStatus === "expired" ? (
                    <p className="mt-2 text-sm font-medium text-red-700 dark:text-red-400">
                      This pairing code expired. Generate a new code to try again.
                    </p>
                  ) : pairingCodeExpiresAt ? (
                    <p className="mt-2 text-xs">
                      Expires {new Date(pairingCodeExpiresAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
              )}
              {deviceError && <p className="mt-4 text-sm text-red-600" role="alert">{deviceError}</p>}
            </div>
          )}

          {testToolsEnabled && (
            <div className="rounded-xl border border-amber-500 bg-amber-50 p-5 text-amber-950 dark:bg-amber-950 dark:text-amber-50">
              <p className="text-xs font-semibold uppercase tracking-widest">Staging testing only</p>
              <h2 className="mt-2 text-xl font-semibold">API testing tool</h2>
              <p className="mt-2 text-sm">
                Copy a short-lived Clerk token for manual API testing.
              </p>
              <div className="mt-5">
                <button
                  className="rounded-lg border border-amber-700 px-4 py-2 font-semibold"
                  onClick={() => void copyBearerToken()}
                  type="button"
                >
                  Copy bearer token
                </button>
              </div>
              {tokenCopyStatus && <p className="mt-4 text-sm" role="status">{tokenCopyStatus}</p>}
            </div>
          )}
        </>
      )}

      {oauthMessage && <p role="status">{oauthMessage}</p>}
      {apiError && <p role="alert" className="text-red-600">{apiError}</p>}
      <p className="text-sm text-zinc-500">
        Mercado Libre credentials are exchanged and stored only by the V2 backend.
      </p>
    </section>
  );
}

export function V2ConnectionPanel() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <main className="p-6">Loading authentication…</main>;
  }

  if (isSignedIn) {
    return <SignedInConnectionPanel />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="text-3xl font-semibold">Sign in to NotiVenta V2</h1>
      <SignInButton mode="modal">
        <button className="rounded-lg bg-black px-5 py-3 font-semibold text-white" type="button">
          Sign in with Clerk
        </button>
      </SignInButton>
    </main>
  );
}
