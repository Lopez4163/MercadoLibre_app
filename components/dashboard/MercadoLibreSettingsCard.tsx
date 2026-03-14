"use client";

import { useState } from "react";

export default function MercadoLibreSettingsCard() {
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect() {
    setDisconnecting(true);
    setError(null);

    try {
      const response = await fetch("/api/ml/disconnect", {
        method: "POST",
      });

      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "failed_to_disconnect");
      }

      window.location.assign("/login?disconnected=mercadolibre");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "failed_to_disconnect");
      setDisconnecting(false);
    }
  }

  return (
    <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Mercado Libre</p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">Account connection</h3>
      <p className="mt-2 text-sm text-[var(--text-2)]">
        Disconnecting revokes this app&apos;s active Mercado Libre session for your user and signs you out.
      </p>

      <div className="mt-5 border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Disconnect access</p>
        <p className="mt-2 text-xs text-[var(--text-2)]">
          Use this if you want to stop syncing this account or switch to a different Mercado Libre seller.
        </p>
        <button
          type="button"
          disabled={disconnecting}
          onClick={() => setConfirmOpen(true)}
          className="mt-3 inline-flex h-10 cursor-pointer items-center justify-center border border-[var(--border-1)] bg-rose-500/10 px-4 text-[11px] font-semibold uppercase tracking-wide text-rose-200 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:text-[var(--text-3)] disabled:hover:bg-rose-500/10"
        >
          {disconnecting ? "Disconnecting..." : "Disconnect Mercado Libre"}
        </button>
        {error ? <p className="mt-3 text-xs text-rose-300">Disconnect error: {error}</p> : null}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
            <h4 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">
              Disconnect Mercado Libre?
            </h4>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              This will remove your active Mercado Libre connection and you will be logged out immediately.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={disconnecting}
                className="inline-flex h-10 items-center border border-[var(--border-1)] bg-transparent px-4 text-sm font-semibold text-[var(--text-1)] hover:border-[var(--text-2)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Keep connected
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmOpen(false);
                  await handleDisconnect();
                }}
                disabled={disconnecting}
                className="inline-flex h-10 items-center border border-red-500/50 bg-red-600/20 px-4 text-sm font-semibold text-red-200 hover:border-red-400 hover:bg-red-600/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Yes, disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
