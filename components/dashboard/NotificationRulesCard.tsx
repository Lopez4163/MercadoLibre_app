"use client";

import { useEffect, useState } from "react";

type NotificationSettingsPayload = {
  notifyEverySale: boolean;
  notifySoldOut: boolean;
  notifyLowStock: boolean;
  lowStockThreshold: number;
};

export default function NotificationRulesCard() {
  const [notifyEverySale, setNotifyEverySale] = useState(false);
  const [notifyLowStock, setNotifyLowStock] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [notifySoldOut, setNotifySoldOut] = useState(true);
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

  useEffect(() => {
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
    </section>
  );
}
