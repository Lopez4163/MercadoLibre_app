"use client";

import { useEffect, useState } from "react";

type NotificationSettingsPayload = {
  notifyEverySale: boolean;
  notifySoldOut: boolean;
  notifyLowStock: boolean;
  lowStockThreshold: number;
};

type NotificationTestType = "sale" | "low_stock" | "sold_out" | "shipping_label" | "channel_health";
const notificationTestOptions: Array<{ value: NotificationTestType; label: string }> = [
  { value: "sale", label: "Sale Alert Sample" },
  { value: "low_stock", label: "Low Stock Sample" },
  { value: "sold_out", label: "Sold Out Sample" },
  { value: "shipping_label", label: "Shipping Label Sample" },
  { value: "channel_health", label: "Channel Health Check" },
];

export default function NotificationRulesCard() {
  const [notifyEverySale, setNotifyEverySale] = useState(false);
  const [notifyLowStock, setNotifyLowStock] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [notifySoldOut, setNotifySoldOut] = useState(true);
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [testRunningType, setTestRunningType] = useState<NotificationTestType | null>(null);
  const [selectedTestType, setSelectedTestType] = useState<NotificationTestType>("sale");
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
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

  useEffect(() => {
    void loadNotificationSettings();
  }, []);

  async function loadNotificationSettings() {
    setSettingsLoading(true);
    setSettingsError(null);
    setSettingsSuccess(null);

    try {
      const [settingsResponse, telegramResponse] = await Promise.all([
        fetch("/api/notifications/settings", { cache: "no-store" }),
        fetch("/api/telegram/status", { cache: "no-store" }),
      ]);
      const data = (await settingsResponse.json()) as {
        ok?: boolean;
        error?: string;
        settings?: NotificationSettingsPayload;
      };
      const telegramData = (await telegramResponse.json()) as {
        ok?: boolean;
        connected?: boolean;
      };

      if (!settingsResponse.ok || !data.ok || !data.settings) {
        throw new Error(data.error ?? "failed_to_load_settings");
      }

      const nextSettings = {
        notifyEverySale: Boolean(data.settings.notifyEverySale),
        notifySoldOut: Boolean(data.settings.notifySoldOut),
        notifyLowStock: Boolean(data.settings.notifyLowStock),
        lowStockThreshold: Number(data.settings.lowStockThreshold) || 0,
      };

      setNotifyEverySale(nextSettings.notifyEverySale);
      setNotifySoldOut(nextSettings.notifySoldOut);
      setNotifyLowStock(nextSettings.notifyLowStock);
      setLowStockThreshold(nextSettings.lowStockThreshold);
      setSavedSettings(nextSettings);
      setTelegramConnected(Boolean(telegramData.ok && telegramData.connected));
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "failed_to_load_settings");
    } finally {
      setSettingsLoading(false);
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

      const nextSettings = {
        notifyEverySale: Boolean(data.settings.notifyEverySale),
        notifySoldOut: Boolean(data.settings.notifySoldOut),
        notifyLowStock: Boolean(data.settings.notifyLowStock),
        lowStockThreshold: Number(data.settings.lowStockThreshold) || 0,
      };

      setNotifyEverySale(nextSettings.notifyEverySale);
      setNotifySoldOut(nextSettings.notifySoldOut);
      setNotifyLowStock(nextSettings.notifyLowStock);
      setLowStockThreshold(nextSettings.lowStockThreshold);
      setSavedSettings(nextSettings);
      setSettingsSuccess("Notification settings saved.");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "failed_to_save_settings");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function runNotificationTest(type: NotificationTestType) {
    setTestRunningType(type);
    setTestError(null);
    setTestSuccess(null);

    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "failed_to_send_test");
      }

      const selectedOption = notificationTestOptions.find((option) => option.value === type);
      setTestSuccess(`${selectedOption?.label ?? "Test"} sent.`);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "failed_to_send_test");
    } finally {
      setTestRunningType(null);
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
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Alert Rules</p>
      <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">Notification settings</h3>
      <p className="mt-2 text-sm text-[var(--text-2)]">
        Configure which sale and inventory transitions should create Telegram alerts.
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

      {settingsError ? <p className="mt-2 text-xs text-rose-300">Settings error: {settingsError}</p> : null}
      {settingsSuccess ? <p className="mt-2 text-xs text-emerald-300">{settingsSuccess}</p> : null}

      <div className="mt-5 border border-[var(--border-1)] bg-[var(--bg-0)] p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Test Notifications</p>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          Validate alert format, rule behavior, and delivery without waiting for real events.
        </p>

        <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_180px]">
          <select
            value={selectedTestType}
            onChange={(event) => setSelectedTestType(event.target.value as NotificationTestType)}
            disabled={settingsLoading || settingsSaving || testRunningType !== null}
            className="h-10 border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-sm text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {notificationTestOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={settingsLoading || settingsSaving || testRunningType !== null}
            onClick={() => runNotificationTest(selectedTestType)}
            className="inline-flex h-10 cursor-pointer items-center justify-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {testRunningType ? "Sending..." : "Run Test"}
          </button>
        </div>

        <div className="mt-3 border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-2)]">
          <p className="font-semibold uppercase tracking-wide text-[var(--text-3)]">Rule Preview</p>
          <ul className="mt-2 space-y-1">
            <li>
              Every sale:{" "}
              <span className={notifyEverySale ? "text-emerald-300" : "text-rose-300"}>
                {notifyEverySale ? "On" : "Off"}
              </span>{" "}
              - {notifyEverySale ? "matching sale events will send alerts." : "sale events are skipped."}
            </li>
            <li>
              Sold out:{" "}
              <span className={notifySoldOut ? "text-emerald-300" : "text-rose-300"}>
                {notifySoldOut ? "On" : "Off"}
              </span>{" "}
              - {notifySoldOut ? "stock transitions to zero will alert." : "sold out events are skipped."}
            </li>
            <li>
              Low stock:{" "}
              <span className={notifyLowStock ? "text-emerald-300" : "text-rose-300"}>{notifyLowStock ? "On" : "Off"}</span>{" "}
              -{" "}
              {notifyLowStock
                ? `alerts trigger when stock drops below ${Math.max(0, Math.floor(lowStockThreshold))}.`
                : "low stock events are skipped."}
            </li>
            <li>
              Channel:{" "}
              <span className={telegramConnected ? "text-emerald-300" : "text-rose-300"}>
                {telegramConnected ? "Connected" : "Not connected"}
              </span>
              {" - "}
              {telegramConnected ? "Telegram delivery is available." : "tests will fail."}
            </li>
            <li>Label alerts: Sent with a sample download label button to validate URL button rendering.</li>
          </ul>
        </div>

        {testError ? <p className="mt-3 text-xs text-rose-300">Test error: {testError}</p> : null}
        {testSuccess ? <p className="mt-3 text-xs text-emerald-300">{testSuccess}</p> : null}
      </div>
    </section>
  );
}
