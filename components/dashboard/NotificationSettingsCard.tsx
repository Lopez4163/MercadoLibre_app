"use client";

import { useEffect, useState } from "react";

type NotificationSettingsPayload = {
  notifyEverySale: boolean;
  notifySoldOut: boolean;
  notifyLowStock: boolean;
  lowStockThreshold: number;
};

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
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [savedSettings, setSavedSettings] = useState<NotificationSettingsPayload | null>(null);

  useEffect(() => {
    if (!settingsSuccess) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSettingsSuccess(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [settingsSuccess]);

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
    void loadNotificationSettings();
  }, []);

  async function loadNotificationSettings() {
    setSettingsLoading(true);
    setSettingsError(null);
    setSettingsSuccess(null);

    try {
      const response = await fetch("/api/notifications/settings", { cache: "no-store" });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        settings?: NotificationSettingsPayload;
      };

      if (!response.ok || !data.ok || !data.settings) {
        throw new Error(data.error ?? "failed_to_load_settings");
      }

      setNotifyEverySale(Boolean(data.settings.notifyEverySale));
      setNotifySoldOut(Boolean(data.settings.notifySoldOut));
      setNotifyLowStock(Boolean(data.settings.notifyLowStock));
      setLowStockThreshold(Number(data.settings.lowStockThreshold) || 0);
      setSavedSettings({
        notifyEverySale: Boolean(data.settings.notifyEverySale),
        notifySoldOut: Boolean(data.settings.notifySoldOut),
        notifyLowStock: Boolean(data.settings.notifyLowStock),
        lowStockThreshold: Number(data.settings.lowStockThreshold) || 0,
      });
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "failed_to_load_settings");
    } finally {
      setSettingsLoading(false);
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

  async function handleSaveSettings() {
    setSettingsSaving(true);
    setSettingsError(null);
    setSettingsSuccess(null);

    try {
      const response = await fetch("/api/notifications/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notifyEverySale,
          notifySoldOut,
          notifyLowStock,
          lowStockThreshold,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        settings?: NotificationSettingsPayload;
      };

      if (!response.ok || !data.ok || !data.settings) {
        throw new Error(data.error ?? "failed_to_save_settings");
      }

      setNotifyEverySale(Boolean(data.settings.notifyEverySale));
      setNotifySoldOut(Boolean(data.settings.notifySoldOut));
      setNotifyLowStock(Boolean(data.settings.notifyLowStock));
      setLowStockThreshold(Number(data.settings.lowStockThreshold) || 0);
      setSavedSettings({
        notifyEverySale: Boolean(data.settings.notifyEverySale),
        notifySoldOut: Boolean(data.settings.notifySoldOut),
        notifyLowStock: Boolean(data.settings.notifyLowStock),
        lowStockThreshold: Number(data.settings.lowStockThreshold) || 0,
      });
      setSettingsSuccess("Notification settings saved.");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "failed_to_save_settings");
    } finally {
      setSettingsSaving(false);
    }
  }

  const hasUnsavedChanges = savedSettings
    ? savedSettings.notifyEverySale !== notifyEverySale ||
      savedSettings.notifySoldOut !== notifySoldOut ||
      savedSettings.notifyLowStock !== notifyLowStock ||
      savedSettings.lowStockThreshold !== lowStockThreshold
    : false;

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
        <div className="flex items-center justify-between px-3 py-3 text-sm">
          <span className="text-[var(--text-1)]">Notify on every item sold</span>
          <button
            type="button"
            role="switch"
            aria-checked={notifyEverySale}
            onClick={() => setNotifyEverySale((current) => !current)}
            disabled={settingsLoading || settingsSaving}
            className={`relative inline-flex h-6 w-11 cursor-pointer items-center border border-[var(--border-1)] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              notifyEverySale ? "bg-emerald-500/30" : "bg-[var(--surface-1)]"
            }`}
          >
            <span
              className={`h-4 w-4 border border-[var(--border-1)] bg-[var(--text-1)] transition-transform ${
                notifyEverySale ? "translate-x-[22px]" : "translate-x-[2px]"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between px-3 py-3 text-sm">
          <span className="text-[var(--text-1)]">Notify on sold out (stock = 0)</span>
          <button
            type="button"
            role="switch"
            aria-checked={notifySoldOut}
            onClick={() => setNotifySoldOut((current) => !current)}
            disabled={settingsLoading || settingsSaving}
            className={`relative inline-flex h-6 w-11 cursor-pointer items-center border border-[var(--border-1)] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              notifySoldOut ? "bg-emerald-500/30" : "bg-[var(--surface-1)]"
            }`}
          >
            <span
              className={`h-4 w-4 border border-[var(--border-1)] bg-[var(--text-1)] transition-transform ${
                notifySoldOut ? "translate-x-[22px]" : "translate-x-[2px]"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between px-3 py-3 text-sm">
          <span className="text-[var(--text-1)]">Notify on low stock</span>
          <button
            type="button"
            role="switch"
            aria-checked={notifyLowStock}
            onClick={() => setNotifyLowStock((current) => !current)}
            disabled={settingsLoading || settingsSaving}
            className={`relative inline-flex h-6 w-11 cursor-pointer items-center border border-[var(--border-1)] transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              notifyLowStock ? "bg-emerald-500/30" : "bg-[var(--surface-1)]"
            }`}
          >
            <span
              className={`h-4 w-4 border border-[var(--border-1)] bg-[var(--text-1)] transition-transform ${
                notifyLowStock ? "translate-x-[22px]" : "translate-x-[2px]"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between px-3 py-3 text-sm">
          <span className="text-[var(--text-1)]">Low stock threshold</span>
          <input
            type="number"
            min={0}
            value={lowStockThreshold}
            disabled={!notifyLowStock || settingsLoading || settingsSaving}
            onChange={(event) => setLowStockThreshold(Number(event.target.value))}
            className="h-9 w-24 border border-[var(--border-1)] bg-[var(--surface-1)] px-2 text-right text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleSaveSettings}
        disabled={settingsLoading || settingsSaving || !hasUnsavedChanges}
        className="mt-4 inline-flex h-10 w-full cursor-pointer items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-[var(--bg-0)] hover:text-[var(--text-1)] disabled:cursor-not-allowed disabled:border-[var(--border-1)] disabled:bg-[var(--surface-2)] disabled:text-[var(--text-3)] disabled:hover:bg-[var(--surface-2)] disabled:hover:text-[var(--text-3)]"
      >
        {settingsSaving ? "Saving..." : "Save Settings"}
      </button>

      <div className="mt-4 border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Telegram Channel</p>
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

        {telegramError ? (
          <p className="mt-3 text-xs text-rose-300">
            Telegram error: {telegramError}
          </p>
        ) : null}
        {telegramSuccess ? (
          <p className="mt-3 text-xs text-emerald-300">{telegramSuccess}</p>
        ) : null}
      </div>

      {settingsError ? <p className="mt-2 text-xs text-rose-300">Settings error: {settingsError}</p> : null}
      {settingsSuccess ? <p className="mt-2 text-xs text-emerald-300">{settingsSuccess}</p> : null}
    </section>
  );
}
