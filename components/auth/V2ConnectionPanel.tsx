"use client";

import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

import {
  getMercadoLibreAccount,
  getCurrentUser,
  startMercadoLibreAuthorization,
  type MercadoLibreAccount,
  type V2CurrentUser,
} from "../../lib/v2/api";
import {
  connectionView,
  mercadoLibreReturnResult,
} from "../../lib/v2/connection-state";

function SignedInConnectionPanel() {
  const { getToken } = useAuth();
  const [user, setUser] = useState<V2CurrentUser | null>(null);
  const [account, setAccount] = useState<MercadoLibreAccount | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const loadState = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("No active Clerk session is available");
      const [currentUser, mercadoLibreAccount] = await Promise.all([
        getCurrentUser(token),
        getMercadoLibreAccount(token),
      ]);
      setUser(currentUser);
      setAccount(mercadoLibreAccount);
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
        <div className="rounded-xl border border-emerald-500 bg-emerald-50 p-5 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50">
          <h2 className="text-xl font-semibold">Mercado Libre connected</h2>
          <p className="mt-2 text-sm">Seller ID: {account.externalSellerId}</p>
          <p className="mt-1 text-sm">NotiVenta will keep this connection securely on the backend.</p>
        </div>
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
