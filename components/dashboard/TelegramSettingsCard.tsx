"use client";

import { useEffect, useState } from "react";

export default function TelegramSettingsCard() {
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramActionLoading, setTelegramActionLoading] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [telegramSuccess, setTelegramSuccess] = useState<string | null>(null);

  useEffect(() => {
    void loadTelegramStatus();
  }, []);

  useEffect(() => {
    if (!telegramSuccess) {
      return;
    }

    const timer = window.setTimeout(() => {
      setTelegramSuccess(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [telegramSuccess]);

  async function loadTelegramStatus() {
    setTelegramLoading(true);
    setTelegramError(null);
    setTelegramSuccess(null);

    try {
      const response = await fetch("/api/telegram/status", { cache: "no-store" });
      const data = (await response.json()) as {
        ok?: boolean;
        connected?: boolean;
        error?: string;
        chatId?: string | null;
      };

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
      setTelegramSuccess("Telegram disconnected.");
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
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Telegram</p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">Delivery channel</h3>
      <p className="mt-2 text-sm text-[var(--text-2)]">
        Connect your Telegram chat, verify delivery, and control test notifications.
      </p>

      <div className="mt-5 border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Connection status</p>
        <div className="mt-2 flex items-center gap-2">
          <span className={`h-2 w-2 ${telegramConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
          <p className={`font-semibold ${telegramConnected ? "text-emerald-300" : "text-amber-300"}`}>
            {telegramLoading ? "Checking..." : telegramConnected ? "Connected" : "Not connected"}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-3 overflow-hidden border border-[var(--border-1)]">
          <button
            type="button"
            disabled={telegramConnected || telegramActionLoading}
            onClick={handleTelegramConnect}
            className="inline-flex h-10 cursor-pointer items-center justify-center border-r border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:text-[var(--text-3)] disabled:hover:bg-[var(--surface-2)]"
          >
            Connect
          </button>
          <button
            type="button"
            disabled={!telegramConnected || telegramActionLoading}
            onClick={handleSendTestPing}
            className="inline-flex h-10 cursor-pointer items-center justify-center border-r border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-2)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:text-[var(--text-3)] disabled:hover:bg-[var(--surface-2)]"
          >
            Test
          </button>
          <button
            type="button"
            disabled={!telegramConnected || telegramActionLoading}
            onClick={handleTelegramDisconnect}
            className="inline-flex h-10 cursor-pointer items-center justify-center bg-[var(--surface-2)] px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-2)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:text-[var(--text-3)] disabled:hover:bg-[var(--surface-2)]"
          >
            Disconnect
          </button>
        </div>

        {telegramError ? <p className="mt-3 text-xs text-rose-300">Telegram error: {telegramError}</p> : null}
        {telegramSuccess ? <p className="mt-3 text-xs text-emerald-300">{telegramSuccess}</p> : null}
      </div>
    </section>
  );
}
