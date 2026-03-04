"use client";

import { useState } from "react";

export default function NotificationSettingsCard() {
  const [notifyEverySale, setNotifyEverySale] = useState(false);
  const [notifyLowStock, setNotifyLowStock] = useState(true);
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [notifySoldOut, setNotifySoldOut] = useState(true);

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
          <span className="h-2 w-2 bg-emerald-400" />
          <p className="font-semibold text-emerald-300">Connected</p>
        </div>
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
