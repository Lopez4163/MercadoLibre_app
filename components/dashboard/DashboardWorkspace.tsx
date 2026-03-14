"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import InventoryTable from "./InventoryTable";

type InventoryItem = {
  id: string;
  title?: string;
  available_quantity?: number;
  sold_quantity?: number;
  price?: number;
  status?: string;
};

type InventoryResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  items?: InventoryItem[];
};

type NotificationSettingsPayload = {
  notifyEverySale: boolean;
  notifySoldOut: boolean;
  notifyLowStock: boolean;
  lowStockThreshold: number;
};

type DashboardWorkspaceProps = {
  mlName: string;
  billingHasAccess: boolean;
  billingStatus: string;
};

type DashboardTab = "overview" | "inventory" | "orders" | "alerts" | "stats";

function formatRelativeTime(timestamp: number | null) {
  if (!timestamp) {
    return "Not synced yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function statusLabel(value: boolean | null) {
  if (value === null) {
    return "Checking";
  }

  return value ? "Connected" : "Not connected";
}

function statusTone(value: boolean | null) {
  if (value === null) {
    return "text-[var(--text-3)]";
  }

  return value ? "text-emerald-300" : "text-amber-300";
}

function toggleLabel(value: boolean | null) {
  if (value === null) {
    return "Checking";
  }

  return value ? "On" : "Off";
}

export default function DashboardWorkspace({
  mlName,
  billingHasAccess,
  billingStatus,
}: DashboardWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [telegramConnected, setTelegramConnected] = useState<boolean | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsPayload | null>(null);

  async function loadInventory(options?: { initial?: boolean }) {
    const initial = options?.initial ?? false;

    try {
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setInventoryError(null);

      const response = await fetch("/api/ml/items", { cache: "no-store" });
      const data = (await response.json()) as InventoryResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Failed to fetch inventory");
      }

      setItems(data.items ?? []);
      setLastUpdatedAt(Date.now());
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      if (initial) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }

  async function loadTelegramStatus() {
    try {
      const response = await fetch("/api/telegram/status", { cache: "no-store" });
      const data = (await response.json()) as { ok?: boolean; connected?: boolean };

      if (!response.ok || !data.ok) {
        throw new Error("failed_to_load_telegram_status");
      }

      setTelegramConnected(Boolean(data.connected));
    } catch {
      setTelegramConnected(false);
    }
  }

  async function loadNotificationSettings() {
    try {
      const response = await fetch("/api/notifications/settings", { cache: "no-store" });
      const data = (await response.json()) as {
        ok?: boolean;
        settings?: NotificationSettingsPayload;
      };

      if (!response.ok || !data.ok || !data.settings) {
        throw new Error("failed_to_load_notification_settings");
      }

      setNotificationSettings({
        notifyEverySale: Boolean(data.settings.notifyEverySale),
        notifySoldOut: Boolean(data.settings.notifySoldOut),
        notifyLowStock: Boolean(data.settings.notifyLowStock),
        lowStockThreshold: Number(data.settings.lowStockThreshold) || 0,
      });
    } catch {
      setNotificationSettings(null);
    }
  }

  useEffect(() => {
    void Promise.all([
      loadInventory({ initial: true }),
      loadTelegramStatus(),
      loadNotificationSettings(),
    ]);
  }, []);

  const soldOutItems = useMemo(
    () => items.filter((item) => item.available_quantity === 0).length,
    [items],
  );
  const criticalItems = useMemo(
    () =>
      items.filter(
        (item) =>
          typeof item.available_quantity === "number" &&
          item.available_quantity > 0 &&
          item.available_quantity <= 3,
      ).length,
    [items],
  );
  const lowItems = useMemo(
    () =>
      items.filter(
        (item) =>
          typeof item.available_quantity === "number" &&
          item.available_quantity > 3 &&
          item.available_quantity <= 10,
      ).length,
    [items],
  );
  const healthyItems = useMemo(
    () =>
      items.filter(
        (item) => typeof item.available_quantity === "number" && item.available_quantity > 10,
      ).length,
    [items],
  );

  const topRiskItems = useMemo(() => {
    return [...items]
      .filter((item) => typeof item.available_quantity === "number")
      .sort((left, right) => (left.available_quantity ?? 0) - (right.available_quantity ?? 0))
      .slice(0, 5);
  }, [items]);

  const activeItems = useMemo(
    () => items.filter((item) => item.status === "active").length,
    [items],
  );
  const pausedItems = useMemo(
    () => items.filter((item) => item.status === "paused").length,
    [items],
  );
  const totalUnitsOnHand = useMemo(
    () =>
      items.reduce((sum, item) => {
        return sum + (typeof item.available_quantity === "number" ? item.available_quantity : 0);
      }, 0),
    [items],
  );
  const averageUnitsPerListing = useMemo(() => {
    if (items.length === 0) {
      return 0;
    }

    return Math.round(totalUnitsOnHand / items.length);
  }, [items, totalUnitsOnHand]);
  const inventoryValue = useMemo(
    () =>
      items.reduce((sum, item) => {
        const quantity = typeof item.available_quantity === "number" ? item.available_quantity : 0;
        const price = typeof item.price === "number" ? item.price : 0;
        return sum + quantity * price;
      }, 0),
    [items],
  );
  const riskRate = useMemo(() => {
    if (items.length === 0) {
      return 0;
    }

    return Math.round(((soldOutItems + criticalItems + lowItems) / items.length) * 100);
  }, [criticalItems, items.length, lowItems, soldOutItems]);
  const topSeller = useMemo(() => {
    return [...items]
      .filter((item) => typeof item.sold_quantity === "number")
      .sort((left, right) => (right.sold_quantity ?? 0) - (left.sold_quantity ?? 0))[0] ?? null;
  }, [items]);
  const totalUnitsSold = useMemo(
    () =>
      items.reduce((sum, item) => {
        return sum + (typeof item.sold_quantity === "number" ? item.sold_quantity : 0);
      }, 0),
    [items],
  );
  const fastMoversAtRisk = useMemo(() => {
    return [...items]
      .filter((item) => {
        const soldQuantity = typeof item.sold_quantity === "number" ? item.sold_quantity : 0;
        const availableQuantity =
          typeof item.available_quantity === "number" ? item.available_quantity : Number.POSITIVE_INFINITY;

        return soldQuantity > 0 && availableQuantity <= 10;
      })
      .sort((left, right) => {
        const leftVelocity = (left.sold_quantity ?? 0) - (left.available_quantity ?? 0);
        const rightVelocity = (right.sold_quantity ?? 0) - (right.available_quantity ?? 0);
        return rightVelocity - leftVelocity;
      })
      .slice(0, 5);
  }, [items]);
  const dormantStock = useMemo(() => {
    return [...items]
      .filter((item) => {
        const soldQuantity = typeof item.sold_quantity === "number" ? item.sold_quantity : 0;
        const availableQuantity = typeof item.available_quantity === "number" ? item.available_quantity : 0;

        return soldQuantity === 0 && availableQuantity > 0;
      })
      .sort((left, right) => (right.available_quantity ?? 0) - (left.available_quantity ?? 0))
      .slice(0, 5);
  }, [items]);
  const sellThroughLeaders = useMemo(() => {
    return [...items]
      .map((item) => {
        const soldQuantity = typeof item.sold_quantity === "number" ? item.sold_quantity : 0;
        const availableQuantity = typeof item.available_quantity === "number" ? item.available_quantity : 0;
        const denominator = soldQuantity + availableQuantity;

        return {
          ...item,
          sellThroughRate: denominator > 0 ? soldQuantity / denominator : 0,
        };
      })
      .filter(
        (item) =>
          (item.sold_quantity ?? 0) > 0 && (item.sold_quantity ?? 0) + (item.available_quantity ?? 0) > 0,
      )
      .sort((left, right) => {
        if (right.sellThroughRate !== left.sellThroughRate) {
          return right.sellThroughRate - left.sellThroughRate;
        }

        return (right.sold_quantity ?? 0) - (left.sold_quantity ?? 0);
      })
      .slice(0, 5);
  }, [items]);

  const tabClass = (tab: DashboardTab) =>
    `inline-flex h-11 items-center border px-4 text-sm font-semibold transition-colors ${
      activeTab === tab
        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)]"
        : "border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-1)] hover:bg-[var(--surface-2)]"
    }`;

  return (
    <main className="space-y-6">
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
          Dashboard
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-1)] md:text-4xl">
              Seller control board
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-2)]">
              A live operational view for inventory risk, delivery readiness, and the next action your team should take.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2">
            <span className={`h-2 w-2 ${billingHasAccess ? "bg-emerald-400" : "bg-red-400"}`} />
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
              Billing {billingStatus}
            </span>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <button type="button" className={tabClass("overview")} onClick={() => setActiveTab("overview")}>
          Overview
        </button>
        <button type="button" className={tabClass("inventory")} onClick={() => setActiveTab("inventory")}>
          Inventory
        </button>
        <button type="button" className={tabClass("orders")} onClick={() => setActiveTab("orders")}>
          Orders
        </button>
        <button type="button" className={tabClass("stats")} onClick={() => setActiveTab("stats")}>
          Stats
        </button>
        <button type="button" className={tabClass("alerts")} onClick={() => setActiveTab("alerts")}>
          Alerts
        </button>
      </section>

      {inventoryError ? (
        <div className="border border-[var(--danger)] bg-[var(--surface-2)] p-4 text-sm text-[var(--danger)]">
          Error: {inventoryError}
        </div>
      ) : null}

      {activeTab === "overview" ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
          <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                  Inventory Performance
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
                  Stock posture at a glance
                </h3>
              </div>
              <button
                type="button"
                onClick={() => void loadInventory()}
                disabled={refreshing}
                className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:opacity-60"
              >
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="border border-red-500/50 bg-red-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Sold Out</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-red-200">{soldOutItems}</p>
              </div>
              <div className="border border-orange-500/50 bg-orange-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">Critical</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-orange-200">{criticalItems}</p>
              </div>
              <div className="border border-amber-500/50 bg-amber-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Low</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-amber-200">{lowItems}</p>
              </div>
              <div className="border border-emerald-500/50 bg-emerald-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Healthy</p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-emerald-200">{healthyItems}</p>
              </div>
            </div>
          </article>

          <div className="grid gap-4">
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Operations Status
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Mercado Libre</span>
                  <span className="text-sm font-semibold text-emerald-300">Connected</span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Telegram</span>
                  <span className={`text-sm font-semibold ${statusTone(telegramConnected)}`}>
                    {statusLabel(telegramConnected)}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">ML Name</span>
                  <span className="text-sm font-semibold text-[var(--text-1)]">{mlName}</span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Last Sync</span>
                  <span className="text-sm font-semibold text-[var(--text-1)]">
                    {loading ? "Loading..." : formatRelativeTime(lastUpdatedAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Catalog Size</span>
                  <span className="text-sm font-semibold text-[var(--text-1)]">
                    {loading ? "Loading..." : items.length}
                  </span>
                </div>
              </div>
            </article>

          </div>

          <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Notification Status</p>
              <Link
                href="/settings/notifications"
                className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-3)] hover:text-[var(--text-1)]"
              >
                Edit
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Every Sale</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-1)]">
                  {toggleLabel(notificationSettings?.notifyEverySale ?? null)}
                </p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Sold Out</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-1)]">
                  {toggleLabel(notificationSettings?.notifySoldOut ?? null)}
                </p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Low Stock</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-1)]">
                  {toggleLabel(notificationSettings?.notifyLowStock ?? null)}
                </p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Threshold</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-1)]">
                  {notificationSettings ? notificationSettings.lowStockThreshold : "Checking"}
                </p>
              </div>
            </div>
          </article>

        </section>
      ) : null}

      {activeTab === "inventory" ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Total Items</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-1)]">{items.length}</p>
            </article>
            <article className="border border-red-500/50 bg-red-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Sold Out</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-red-200">{soldOutItems}</p>
            </article>
            <article className="border border-orange-500/50 bg-orange-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">Critical</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-orange-200">{criticalItems}</p>
            </article>
            <article className="border border-amber-500/50 bg-amber-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Low</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-amber-200">{lowItems}</p>
            </article>
            <article className="border border-emerald-500/50 bg-emerald-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Healthy</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-emerald-200">{healthyItems}</p>
            </article>
          </div>

          <InventoryTable
            items={items}
            refreshing={refreshing}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={() => void loadInventory()}
          />
        </section>
      ) : null}

      {activeTab === "orders" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Orders</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
              Order workspace is the next UI layer
            </h3>
            <p className="mt-3 text-sm text-[var(--text-2)]">
              The backend already processes order webhooks, sale notifications, shipment labels, and dedupe. The dashboard still needs a dedicated order feed.
            </p>
            <ul className="mt-4 space-y-3 text-sm text-[var(--text-2)]">
              <li>Orders trigger Telegram sale alerts immediately.</li>
              <li>Shipment label follow-ups are sent only once the label is actually ready.</li>
              <li>Webhook dedupe prevents duplicated sale and label notifications.</li>
            </ul>
          </article>

          <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Next Actions</p>
            <div className="mt-4 grid gap-3">
              <Link
                href="/settings/telegram"
                className="inline-flex h-11 items-center justify-center border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
              >
                Verify Telegram delivery
              </Link>
              <Link
                href="/profile"
                className="inline-flex h-11 items-center justify-center border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
              >
                Review account profile
              </Link>
              <button
                type="button"
                onClick={() => setActiveTab("inventory")}
                className="inline-flex h-11 items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
              >
                Inspect inventory risk
              </button>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "stats" ? (
        <section className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
            <article className="overflow-hidden border border-[var(--border-1)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_55%),var(--surface-1)] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                    Top Seller
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-1)]">
                    {topSeller ? topSeller.title ?? topSeller.id : "No sales data yet"}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm text-[var(--text-2)]">
                    Highest-selling listing across the current Mercado Libre catalog snapshot.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadInventory()}
                  disabled={refreshing}
                  className="inline-flex h-10 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:opacity-60"
                >
                  {refreshing ? "Refreshing..." : "Refresh Stats"}
                </button>
              </div>

              {topSeller ? (
                <>
                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                      <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Units Sold</p>
                      <p className="mt-2 text-4xl font-semibold tracking-tight text-[var(--text-1)]">
                        {topSeller.sold_quantity?.toLocaleString("en-US") ?? 0}
                      </p>
                    </div>
                    <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                      <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Units On Hand</p>
                      <p className="mt-2 text-4xl font-semibold tracking-tight text-[var(--text-1)]">
                        {typeof topSeller.available_quantity === "number"
                          ? topSeller.available_quantity.toLocaleString("en-US")
                          : "Unknown"}
                      </p>
                    </div>
                    <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                      <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Listing Value</p>
                      <p className="mt-2 text-4xl font-semibold tracking-tight text-[var(--text-1)]">
                        $
                        {typeof topSeller.price === "number"
                          ? topSeller.price.toLocaleString("en-US")
                          : "Unknown"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                    <span className="border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-2 font-mono text-[var(--text-2)]">
                      {topSeller.id}
                    </span>
                    <span className="border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-emerald-200">
                      Leading by sold quantity
                    </span>
                  </div>
                </>
              ) : (
                <div className="mt-6 border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                  <p className="text-sm text-[var(--text-2)]">
                    No `sold_quantity` data is available in the loaded catalog yet.
                  </p>
                </div>
              )}
            </article>

            <div className="grid gap-4">
              <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                  Total Units Sold
                </p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-[var(--text-1)]">
                  {totalUnitsSold.toLocaleString("en-US")}
                </p>
                <p className="mt-2 text-sm text-[var(--text-2)]">
                  Lifetime units sold across the current Mercado Libre catalog.
                </p>
              </article>

              <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                  Risk Rate
                </p>
                <p className="mt-3 text-4xl font-semibold tracking-tight text-[var(--text-1)]">
                  {riskRate}%
                </p>
                <p className="mt-2 text-sm text-[var(--text-2)]">
                  Listings currently sold out, critical, or low on stock.
                </p>
              </article>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Inventory Value
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-1)]">
                ${inventoryValue.toLocaleString("en-US")}
              </p>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Estimated from current listing price x available units.
              </p>
            </article>

            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Units On Hand
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-1)]">
                {totalUnitsOnHand.toLocaleString("en-US")}
              </p>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Total available quantity across loaded listings.
              </p>
            </article>

            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Avg Units / Listing
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-1)]">
                {averageUnitsPerListing.toLocaleString("en-US")}
              </p>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Useful for spotting shallow catalog depth fast.
              </p>
            </article>

            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Catalog Readout
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Catalog Size</span>
                  <span className="text-sm font-semibold text-[var(--text-1)]">{items.length}</span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Healthy Listings</span>
                  <span className="text-sm font-semibold text-emerald-300">{healthyItems}</span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Last Sync</span>
                  <span className="text-sm font-semibold text-[var(--text-1)]">
                    {loading ? "Loading..." : formatRelativeTime(lastUpdatedAt)}
                  </span>
                </div>
              </div>
            </article>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.05fr)_360px]">
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                    Listing Breakdown
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
                    Catalog composition
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => void loadInventory()}
                  disabled={refreshing}
                  className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:opacity-60"
                >
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="border border-emerald-500/40 bg-emerald-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Active Listings</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-emerald-200">{activeItems}</p>
                </div>
                <div className="border border-slate-400/40 bg-slate-400/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-200">Paused Listings</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-100">{pausedItems}</p>
                </div>
                <div className="border border-red-500/40 bg-red-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Sold Out Share</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-red-200">
                    {items.length === 0 ? "0%" : `${Math.round((soldOutItems / items.length) * 100)}%`}
                  </p>
                </div>
                <div className="border border-amber-500/40 bg-amber-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Low Stock Share</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-amber-200">
                    {items.length === 0 ? "0%" : `${Math.round(((criticalItems + lowItems) / items.length) * 100)}%`}
                  </p>
                </div>
              </div>
            </article>

            <div className="grid gap-4">
              <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                  Fast Movers At Risk
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
                  Popular items running shallow
                </h3>
                <div className="mt-4 space-y-3">
                  {fastMoversAtRisk.length === 0 ? (
                    <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                      <p className="text-sm text-[var(--text-2)]">
                        No high-selling low-stock listings are currently in the loaded catalog.
                      </p>
                    </div>
                  ) : (
                    fastMoversAtRisk.map((item, index) => (
                      <div
                        key={item.id}
                        className="border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-red-500/40 bg-red-500/10 text-xs font-semibold text-red-200">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[var(--text-1)]">
                              {item.title ?? item.id}
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--text-3)]">
                              <span>Sold: {(item.sold_quantity ?? 0).toLocaleString("en-US")}</span>
                              <span>
                                Stock:{" "}
                                {typeof item.available_quantity === "number"
                                  ? item.available_quantity.toLocaleString("en-US")
                                  : "Unknown"}
                              </span>
                            </div>
                            <div className="mt-3 h-2 overflow-hidden bg-[var(--surface-2)]">
                              <div
                                className="h-full bg-red-400"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round(
                                      ((item.sold_quantity ?? 0) /
                                        Math.max((item.sold_quantity ?? 0) + (item.available_quantity ?? 0), 1)) *
                                        100,
                                    ),
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>

              <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                  Dormant Stock
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
                  Inventory sitting without sales
                </h3>
                <div className="mt-4 space-y-3">
                  {dormantStock.length === 0 ? (
                    <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                      <p className="text-sm text-[var(--text-2)]">
                        No inactive stock stands out from the current catalog snapshot.
                      </p>
                    </div>
                  ) : (
                    dormantStock.map((item, index) => (
                      <div
                        key={item.id}
                        className="border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-amber-500/40 bg-amber-500/10 text-xs font-semibold text-amber-200">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[var(--text-1)]">
                              {item.title ?? item.id}
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--text-3)]">
                              <span>Sold: {(item.sold_quantity ?? 0).toLocaleString("en-US")}</span>
                              <span>
                                Stock:{" "}
                                {typeof item.available_quantity === "number"
                                  ? item.available_quantity.toLocaleString("en-US")
                                  : "Unknown"}
                              </span>
                            </div>
                            <div className="mt-3 h-2 overflow-hidden bg-[var(--surface-2)]">
                              <div
                                className="h-full bg-amber-400"
                                style={{
                                  width: `${Math.min(
                                    100,
                                    Math.round(
                                      ((item.available_quantity ?? 0) /
                                        Math.max(
                                          dormantStock[0]?.available_quantity ?? item.available_quantity ?? 1,
                                          1,
                                        )) *
                                        100,
                                    ),
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </div>

            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Sell-Through Leaders
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
                Listings moving the cleanest
              </h3>
              <div className="mt-4 space-y-3">
                {sellThroughLeaders.length === 0 ? (
                  <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                    <p className="text-sm text-[var(--text-2)]">
                      No sell-through leaders can be calculated from the current catalog snapshot.
                    </p>
                  </div>
                ) : (
                  sellThroughLeaders.map((item, index) => (
                    <div
                      key={item.id}
                      className="border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-emerald-500/40 bg-emerald-500/10 text-xs font-semibold text-emerald-200">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[var(--text-1)]">
                            {item.title ?? item.id}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--text-3)]">
                            <span>Sell-through: {Math.round(item.sellThroughRate * 100)}%</span>
                            <span>Sold: {(item.sold_quantity ?? 0).toLocaleString("en-US")}</span>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden bg-[var(--surface-2)]">
                            <div
                              className="h-full bg-emerald-400"
                              style={{ width: `${Math.round(item.sellThroughRate * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>
          </div>
        </section>
      ) : null}

      {activeTab === "alerts" ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Alerts</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
              Current alert posture
            </h3>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Every Sale</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-1)]">
                  {toggleLabel(notificationSettings?.notifyEverySale ?? null)}
                </p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Telegram</p>
                <p className={`mt-2 text-3xl font-semibold ${statusTone(telegramConnected)}`}>
                  {statusLabel(telegramConnected)}
                </p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Sold Out Rule</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-1)]">
                  {toggleLabel(notificationSettings?.notifySoldOut ?? null)}
                </p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Low Stock Rule</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-1)]">
                  {toggleLabel(notificationSettings?.notifyLowStock ?? null)}
                </p>
              </div>
            </div>
          </article>

          <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Priority Watchlist</p>
            <div className="mt-4 space-y-3">
              {topRiskItems.length === 0 ? (
                <p className="text-sm text-[var(--text-2)]">
                  No inventory data loaded yet. Refresh inventory to populate the risk watchlist.
                </p>
              ) : (
                topRiskItems.map((item) => (
                  <div
                    key={item.id}
                    className="border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3"
                  >
                    <p className="text-sm font-semibold text-[var(--text-1)]">{item.title ?? item.id}</p>
                    <p className="mt-1 text-xs text-[var(--text-3)]">
                      Stock: {typeof item.available_quantity === "number" ? item.available_quantity : "Unknown"}
                    </p>
                  </div>
                ))
              )}
            </div>
            <Link
              href="/settings/notifications"
              className="mt-4 inline-flex h-10 w-full items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
            >
              Tune alert settings
            </Link>
          </article>
        </section>
      ) : null}
    </main>
  );
}
