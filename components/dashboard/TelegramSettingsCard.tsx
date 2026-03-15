"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function TelegramSettingsCard() {
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramActionLoading, setTelegramActionLoading] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [telegramSuccess, setTelegramSuccess] = useState<string | null>(null);
  const [hasBillingAccess, setHasBillingAccess] = useState(false);

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
      const [response, billingResponse] = await Promise.all([
        fetch("/api/telegram/status", { cache: "no-store" }),
        fetch("/api/billing/status", { cache: "no-store" }),
      ]);
      const data = (await response.json()) as {
        ok?: boolean;
        connected?: boolean;
        error?: string;
        chatId?: string | null;
      };
      const billingData = (await billingResponse.json()) as {
        ok?: boolean;
        hasAccess?: boolean;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "failed_to_load_status");
      }

      setTelegramConnected(Boolean(data.connected));
      setHasBillingAccess(Boolean(billingData.ok && billingData.hasAccess));
    } catch (error) {
      setHasBillingAccess(false);
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
        message?: string;
        requiresBotUsername?: boolean;
      };

      if (!response.ok || !data.ok) {
        if (response.status === 402 || data.error === "subscription_required") {
          setHasBillingAccess(false);
        }
        throw new Error(data.message ?? data.error ?? "failed_to_create_connect_link");
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
      const data = (await response.json()) as { ok?: boolean; error?: string; message?: string };

      if (!response.ok || !data.ok) {
        if (response.status === 402 || data.error === "subscription_required") {
          setHasBillingAccess(false);
        }
        throw new Error(data.message ?? data.error ?? "failed_to_send_test_ping");
      }

      setTelegramSuccess("Test ping sent.");
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : "failed_to_send_test_ping");
    } finally {
      setTelegramActionLoading(false);
    }
  }
  const controlsDisabled = telegramLoading || telegramActionLoading || !hasBillingAccess;

  return (
    <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Telegram</p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">Delivery channel</h3>
      <p className="mt-2 text-sm text-[var(--text-2)]">
        Connect your Telegram chat, verify delivery, and control test notifications.
      </p>

      <div className="relative mt-5">
        <div
          className={`transition-opacity ${!hasBillingAccess ? "pointer-events-none opacity-45" : "opacity-100"}`}
          aria-hidden={!hasBillingAccess}
        >
          <div className="border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3 text-sm">
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
                disabled={telegramConnected || controlsDisabled}
                onClick={handleTelegramConnect}
                className="inline-flex h-10 cursor-pointer items-center justify-center border-r border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:text-[var(--text-3)] disabled:hover:bg-[var(--surface-2)]"
              >
                Connect
              </button>
              <button
                type="button"
                disabled={!telegramConnected || controlsDisabled}
                onClick={handleSendTestPing}
                className="inline-flex h-10 cursor-pointer items-center justify-center border-r border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-2)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:text-[var(--text-3)] disabled:hover:bg-[var(--surface-2)]"
              >
                Test
              </button>
              <button
                type="button"
                disabled={!telegramConnected || controlsDisabled}
                onClick={handleTelegramDisconnect}
                className="inline-flex h-10 cursor-pointer items-center justify-center bg-[var(--surface-2)] px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-2)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:text-[var(--text-3)] disabled:hover:bg-[var(--surface-2)]"
              >
                Disconnect
              </button>
            </div>

            {telegramError ? <p className="mt-3 text-xs text-rose-300">Telegram error: {telegramError}</p> : null}
            {telegramSuccess ? <p className="mt-3 text-xs text-emerald-300">{telegramSuccess}</p> : null}
          </div>
        </div>

        {!hasBillingAccess ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45 p-4">
            <div className="max-w-md border border-cyan-500/55 bg-cyan-500/10 p-4 text-center shadow-lg">
              <p className="text-sm font-semibold text-[var(--text-1)]">
                Start your free trial to view and manage Telegram delivery settings.
              </p>
              <Link
                href="/billing?intent=trial"
                className="mt-3 inline-flex h-10 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--bg-0)] hover:text-[var(--text-1)]"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
