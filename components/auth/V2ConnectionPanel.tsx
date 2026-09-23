"use client";

import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

import {
  getCurrentUser,
  startMercadoLibreAuthorization,
  type V2CurrentUser,
} from "../../lib/v2/api";

function SignedInConnectionPanel() {
  const { getToken } = useAuth();
  const [user, setUser] = useState<V2CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const loadUser = useCallback(async () => {
    setLoadingUser(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("No active Clerk session is available");
      setUser(await getCurrentUser(token));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to resolve the V2 user");
    } finally {
      setLoadingUser(false);
    }
  }, [getToken]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  async function connectMercadoLibre() {
    setConnecting(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("No active Clerk session is available");
      const { authorizationUrl } = await startMercadoLibreAuthorization(token);
      window.location.assign(authorizationUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start Mercado Libre authorization");
      setConnecting(false);
    }
  }

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
        {loadingUser && <p>Resolving your V2 account…</p>}
        {!loadingUser && user && (
          <dl className="grid gap-2 text-sm">
            <div><dt className="font-medium">Internal ID</dt><dd className="break-all">{user.id}</dd></div>
            <div><dt className="font-medium">Email</dt><dd>{user.email}</dd></div>
            <div><dt className="font-medium">Name</dt><dd>{user.name ?? "Not provided"}</dd></div>
          </dl>
        )}
        {!loadingUser && (
          <button className="mt-4 underline" onClick={() => void loadUser()} type="button">
            Refresh identity
          </button>
        )}
      </div>

      <button
        className="rounded-lg bg-yellow-400 px-5 py-3 font-semibold text-black disabled:opacity-50"
        disabled={!user || connecting}
        onClick={() => void connectMercadoLibre()}
        type="button"
      >
        {connecting ? "Opening Mercado Libre…" : "Connect Mercado Libre"}
      </button>

      {error && <p role="alert" className="text-red-600">{error}</p>}
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
