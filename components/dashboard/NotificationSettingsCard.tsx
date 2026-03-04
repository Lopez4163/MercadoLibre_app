"use client";

import { useEffect, useState } from "react";

export default function NotificationSettingsCard() {
  const [notifyEverySale, setNotifyEverySale] = useState(false);
  const [notifyLowStock, setNotifyLowStock] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [notifySoldOut, setNotifySoldOut] = useState(true);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramActionLoading, setTelegramActionLoading] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [telegramSuccess, setTelegramSuccess] = useState<string | null>(null);

  async function loadTelegramStatus() {
    setTelegramLoading(true);
    setTelegramError(null);
    setTelegramSuccess(null);

    try {
      const response = await fetch("/api/telegram/status", { cache: "no-store" });
      const data = (await response.json()) as { ok?: boolean; connected?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "failed_to_load_status");
      }

      setTelegramConnected(Boolean(data.connected));
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : "failed_to_load_status");
    } finally {
      setTelegramLoading(false);
    }
  }

  useEffect(() => {
    void loadTelegramStatus();
  }, []);

  async function handleTelegramConnect() {
    setTelegramActionLoading(true);
    setTelegramError(null);
    setTelegramSuccess(null);

    try {
      const response = await fetch("/api/telegram/connect", { cache: "no-store" });
      const data = (await response.json()) as {
        ok?: boolean;
        connectUrl?: string | null;
        error?: string;
        requiresBotUsername?: boolean;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "failed_to_create_connect_link");
      }

      if (!data.connectUrl) {
        if (data.requiresBotUsername) {
          throw new Error("missing TELEGRAM_BOT_USERNAME");
        }
        throw new Error("missing_connect_url");
      }

      window.open(data.connectUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : "failed_to_connect");
    } finally {
      setTelegramActionLoading(false);
    }
  }

  async function handleTelegramDisconnect() {
    setTelegramActionLoading(true);
    setTelegramError(null);
    setTelegramSuccess(null);

    try {
      const response = await fetch("/api/telegram/disconnect", {
        method: "POST",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "failed_to_disconnect");
      }

      await loadTelegramStatus();
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : "failed_to_disconnect");
    } finally {
      setTelegramActionLoading(false);
    }
  }

  async function handleSendTestPing() {
    setTelegramActionLoading(true);
    setTelegramError(null);
    setTelegramSuccess(null);

    try {
      const response = await fetch("/api/telegram/test", {
        method: "POST",
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "failed_to_send_test_ping");
      }

      setTelegramSuccess("Test ping sent.");
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : "failed_to_send_test_ping");
    } finally {
      setTelegramActionLoading(false);
    }
  }

  return (
    <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
        Alert Rules
      </p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">Notification Settings</h3>
      <p className="mt-2 text-sm text-[var(--text-2)]">
        Configure how and when Telegram alerts are triggered.
      </p>

      <div className="mt-5 divide-y divide-[var(--border-1)] border border-[var(--border-1)] bg-[var(--bg-0)]">
        <label className="flex items-center justify-between px-3 py-3 text-sm">
          <span className="text-[var(--text-1)]">Notify on every item sold</span>
          <input
            type="checkbox"
            checked={notifyEverySale}
            onChange={(event) => setNotifyEverySale(event.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
        </label>

        <label className="flex items-center justify-between px-3 py-3 text-sm">
          <span className="text-[var(--text-1)]">Notify on sold out (stock = 0)</span>
          <input
            type="checkbox"
            checked={notifySoldOut}
            onChange={(event) => setNotifySoldOut(event.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
        </label>

        <label className="flex items-center justify-between px-3 py-3 text-sm">
          <span className="text-[var(--text-1)]">Notify on low stock</span>
          <input
            type="checkbox"
            checked={notifyLowStock}
            onChange={(event) => setNotifyLowStock(event.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
        </label>

        <div className="flex items-center justify-between px-3 py-3 text-sm">
          <span className="text-[var(--text-1)]">Low stock threshold</span>
          <input
            type="number"
            min={0}
            value={lowStockThreshold}
            disabled={!notifyLowStock}
            onChange={(event) => setLowStockThreshold(Number(event.target.value))}
            className="h-9 w-24 border border-[var(--border-1)] bg-[var(--surface-1)] px-2 text-right text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>

      <div className="mt-4 border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Telegram Channel</p>
        <div className="mt-2 flex items-center gap-2">
          <span className={`h-2 w-2 ${telegramConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
          <p className={`font-semibold ${telegramConnected ? "text-emerald-300" : "text-amber-300"}`}>
            {telegramLoading ? "Checking..." : telegramConnected ? "Connected" : "Not connected"}
          </p>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={telegramActionLoading}
            onClick={handleTelegramConnect}
            className="inline-flex h-9 items-center justify-center border border-[var(--border-1)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Connect Telegram
          </button>
          <button
            type="button"
            disabled={!telegramConnected || telegramActionLoading}
            onClick={handleTelegramDisconnect}
            className="inline-flex h-9 items-center justify-center border border-[var(--border-1)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-2)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Disconnect
          </button>
          <button
            type="button"
            disabled={!telegramConnected || telegramActionLoading}
            onClick={handleSendTestPing}
            className="inline-flex h-9 items-center justify-center border border-[var(--border-1)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-2)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Test Ping
          </button>
        </div>

        {telegramError ? (
          <p className="mt-3 text-xs text-rose-300">
            Telegram error: {telegramError}
          </p>
        ) : null}
        {telegramSuccess ? (
          <p className="mt-3 text-xs text-emerald-300">{telegramSuccess}</p>
        ) : null}
      </div>

      <button
        type="button"
        className="mt-4 inline-flex h-10 w-full items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--bg-0)] hover:text-[var(--text-1)]"
      >
        Save Settings (Soon)
      </button>

      <p className="mt-2 text-xs text-[var(--text-3)]">
        This is a UI preview; API persistence will be connected next.
      </p>
    </section>
  );
}
