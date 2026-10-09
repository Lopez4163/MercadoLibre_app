"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import {
  readFulfillmentPanelCollapsed,
  writeFulfillmentPanelCollapsed,
} from "../../lib/v2/fulfillment-panel-preference";

interface V2WorkstationShellProps {
  operations: ReactNode;
  fulfillment: ReactNode;
}

/**
 * V2 operations and the read-only fulfillment queue share one responsive shell.
 */
export function V2WorkstationShell({
  operations,
  fulfillment,
}: V2WorkstationShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(readFulfillmentPanelCollapsed(window.localStorage));
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  function toggleDesktopPanel() {
    const next = !collapsed;
    setCollapsed(next);
    writeFulfillmentPanelCollapsed(window.localStorage, next);
  }

  const panelContentClassName = mobileOpen
    ? "block"
    : collapsed
      ? "hidden"
      : "hidden lg:block";

  return (
    <main
      className={`mx-auto grid min-h-screen max-w-6xl gap-6 px-6 py-12 transition-[grid-template-columns] duration-300 ease-out ${
        collapsed
          ? "lg:grid-cols-[minmax(0,1fr)_4rem]"
          : "lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]"
      }`}
    >
      <section aria-labelledby="operations-heading" className="space-y-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-widest text-zinc-500">NotiVenta V2</p>
            <h1 id="operations-heading" className="mt-2 text-3xl font-semibold">
              Operations workstation
            </h1>
          </div>
          <button
            aria-controls="fulfillment-panel"
            aria-expanded={mobileOpen}
            className="rounded-lg border border-zinc-400 px-3 py-2 text-sm font-semibold lg:hidden"
            onClick={() => setMobileOpen(true)}
            type="button"
          >
            Open queue
          </button>
        </header>
        {operations}
      </section>
      {mobileOpen && (
        <button
          aria-label="Close fulfillment queue"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      )}
      <aside
        aria-modal={mobileOpen || undefined}
        aria-labelledby="fulfillment-heading"
        className={`z-50 rounded-xl border border-zinc-300 bg-white p-5 shadow-xl transition-all duration-300 ease-out dark:border-zinc-700 dark:bg-zinc-950 lg:static lg:block lg:shadow-none ${
          mobileOpen
            ? "fixed inset-y-0 right-0 w-[min(100%,28rem)] overflow-y-auto"
            : "hidden"
        }`}
        id="fulfillment-panel"
        role={mobileOpen ? "dialog" : undefined}
      >
        <div className="flex items-start justify-between gap-3">
          <div className={collapsed && !mobileOpen ? "sr-only" : ""}>
            <p className="text-sm uppercase tracking-widest text-zinc-500">Read-only</p>
            <h2 id="fulfillment-heading" className="mt-2 text-xl font-semibold">
              Fulfillment Queue
            </h2>
          </div>
          <button
            aria-label={mobileOpen ? "Close fulfillment queue" : collapsed ? "Expand fulfillment queue" : "Collapse fulfillment queue"}
            aria-controls="fulfillment-panel"
            aria-expanded={mobileOpen || !collapsed}
            autoFocus={mobileOpen}
            className="rounded-lg border border-zinc-400 px-3 py-2 text-sm font-semibold"
            onClick={() => mobileOpen ? setMobileOpen(false) : toggleDesktopPanel()}
            type="button"
          >
            {mobileOpen ? "Close" : collapsed ? "›" : "‹"}
          </button>
        </div>
        {collapsed && !mobileOpen && (
          <p className="mt-5 text-center text-xs font-semibold uppercase tracking-widest text-zinc-500">Queue</p>
        )}
        <div className={panelContentClassName}>{fulfillment}</div>
      </aside>
    </main>
  );
}
