"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import InventoryTable from "./InventoryTable";

type InventoryItem = {
  id: string;
  title?: string;
  available_quantity?: number;
  sold_quantity?: number;
  price?: number;
  status?: string;
  thumbnail?: string;
  pictures?: Array<{
    url?: string;
    secure_url?: string;
  }>;
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

type OrderLine = {
  mlItemId: string;
  title: string;
  quantity: number;
  unitPrice: number | null;
};

type OrderNotification = {
  eventType: string;
  status: string;
  reason: string | null;
  createdAt: string;
};

type DashboardOrder = {
  id: string;
  mlOrderId: string;
  status: string;
  saleType: string | null;
  totalAmount: number | null;
  createdAt: string;
  createdAtMl: string | null;
  updatedAtMl: string | null;
  lastSeenAt: string;
  lines: OrderLine[];
  latestNotification: OrderNotification | null;
  labelUrl: string | null;
};

type OrdersRecentResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  orders?: DashboardOrder[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
  };
};

type TodayActivity = {
  orders: number;
  unitsSold: number;
  alertsSent: number;
  alertsFailed: number;
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function normalizeImageUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value.startsWith("http://") ? `https://${value.slice(7)}` : value;
}

function orderStatusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("paid") || normalized.includes("confirmed")) {
    return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  }
  if (normalized.includes("cancel") || normalized.includes("closed")) {
    return "text-red-300 border-red-500/40 bg-red-500/10";
  }
  return "text-amber-300 border-amber-500/40 bg-amber-500/10";
}

function telegramStatusTone(status: string | null) {
  if (!status) {
    return "text-[var(--text-3)] border-[var(--border-1)] bg-[var(--bg-0)]";
  }
  if (status === "sent") {
    return "text-emerald-300 border-emerald-500/40 bg-emerald-500/10";
  }
  return "text-red-300 border-red-500/40 bg-red-500/10";
}

function topSellerRankTone(rank: number) {
  if (rank === 1) {
    return "border-yellow-400/50 bg-yellow-400/15 text-yellow-200";
  }
  if (rank === 2) {
    return "border-slate-300/50 bg-slate-300/10 text-slate-100";
  }
  if (rank === 3) {
    return "border-amber-600/50 bg-amber-600/15 text-amber-200";
  }
  if (rank === 4) {
    return "border-sky-400/45 bg-sky-400/10 text-sky-200";
  }
  if (rank === 5) {
    return "border-zinc-400/45 bg-zinc-400/10 text-zinc-200";
  }
  return "border-[var(--border-1)] bg-[var(--surface-2)] text-[var(--text-2)]";
}

function RefreshSpinner() {
  return (
    <motion.span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, ease: "linear", repeat: Number.POSITIVE_INFINITY }}
    />
  );
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
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotalPages, setOrdersTotalPages] = useState(1);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [ordersLoadedOnce, setOrdersLoadedOnce] = useState(false);
  const [todayActivity, setTodayActivity] = useState<TodayActivity>({
    orders: 0,
    unitsSold: 0,
    alertsSent: 0,
    alertsFailed: 0,
  });
  const [todayActivityLoading, setTodayActivityLoading] = useState(true);
  const [todayActivityError, setTodayActivityError] = useState<string | null>(null);

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

  const loadOrders = useCallback(async (options?: { page?: number; status?: string }) => {
    const page = options?.page ?? ordersPage;
    const status = options?.status ?? orderStatusFilter;

    try {
      setOrdersLoading(true);
      setOrdersError(null);

      const query = new URLSearchParams({
        page: String(page),
        pageSize: "25",
      });
      if (status !== "all") {
        query.set("status", status);
      }

      const response = await fetch(`/api/orders/recent?${query.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as OrdersRecentResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Failed to fetch orders");
      }

      setOrders(data.orders ?? []);
      setOrdersPage(data.pagination?.page ?? page);
      setOrdersTotalPages(data.pagination?.totalPages ?? 1);
      setOrdersTotal(data.pagination?.total ?? 0);
      setOrdersLoadedOnce(true);
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setOrdersLoading(false);
    }
  }, [orderStatusFilter, ordersPage]);

  const loadTodayActivity = useCallback(async () => {
    try {
      setTodayActivityLoading(true);
      setTodayActivityError(null);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const query = new URLSearchParams({
        page: "1",
        pageSize: "100",
        dateFrom: startOfDay.toISOString(),
        dateTo: endOfDay.toISOString(),
      });
      const response = await fetch(`/api/orders/recent?${query.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as OrdersRecentResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Failed to fetch today's activity");
      }

      const todayOrders = data.orders ?? [];
      const unitsSold = todayOrders.reduce((sum, order) => {
        return (
          sum +
          order.lines.reduce((lineSum, line) => {
            return lineSum + line.quantity;
          }, 0)
        );
      }, 0);

      setTodayActivity({
        orders: data.pagination?.total ?? todayOrders.length,
        unitsSold,
        alertsSent: todayOrders.filter((order) => order.latestNotification?.status === "sent").length,
        alertsFailed: todayOrders.filter((order) => order.latestNotification?.status === "failed").length,
      });
    } catch (error) {
      setTodayActivityError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setTodayActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      loadInventory({ initial: true }),
      loadTelegramStatus(),
      loadNotificationSettings(),
      loadTodayActivity(),
    ]);
  }, [loadTodayActivity]);

  useEffect(() => {
    if (activeTab === "orders" && !ordersLoadedOnce) {
      void loadOrders({ page: 1, status: orderStatusFilter });
    }
  }, [activeTab, loadOrders, orderStatusFilter, ordersLoadedOnce]);

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
  const topSellers = useMemo(() => {
    return [...items]
      .filter((item) => typeof item.sold_quantity === "number")
      .sort((left, right) => (right.sold_quantity ?? 0) - (left.sold_quantity ?? 0))
      .slice(0, 3);
  }, [items]);
  function getItemImageUrl(item: InventoryItem) {
    const thumb = normalizeImageUrl(item.thumbnail);
    if (thumb) {
      return thumb;
    }

    if (Array.isArray(item.pictures) && item.pictures.length > 0) {
      const first = item.pictures[0];
      return normalizeImageUrl(
        (typeof first?.secure_url === "string" ? first.secure_url : null) ??
          (typeof first?.url === "string" ? first.url : null),
      );
    }

    return null;
  }
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
          <div className="space-y-4">
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
                  {refreshing ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshSpinner />
                      Refreshing...
                    </span>
                  ) : (
                    "Refresh"
                  )}
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

            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                    Top 3 Best Sellers
                  </p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">
                    Snapshot by units sold
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("stats")}
                  className="inline-flex h-8 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)]"
                >
                  View Full Stats
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {topSellers.length === 0 ? (
                  <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                    <p className="text-sm text-[var(--text-2)]">No sales data available yet.</p>
                  </div>
                ) : (
                  topSellers.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center border text-xs font-semibold ${topSellerRankTone(index + 1)}`}
                        >
                          {index + 1}
                        </span>
                        <p className="truncate text-sm font-semibold text-[var(--text-1)]">
                          {item.title ?? item.id}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-[var(--text-3)]">
                        Sold:{" "}
                        <span className="font-semibold text-[var(--text-1)]">
                          {(item.sold_quantity ?? 0).toLocaleString("en-US")}
                        </span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                  Notification Status
                </p>
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
          </div>

          <div className="grid gap-4">
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                    Today Activity
                  </p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">
                    Daily operational pulse
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => void loadTodayActivity()}
                  disabled={todayActivityLoading}
                  className="inline-flex h-8 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:opacity-60"
                >
                  {todayActivityLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshSpinner />
                      Refreshing...
                    </span>
                  ) : (
                    "Refresh"
                  )}
                </button>
              </div>

              {todayActivityError ? (
                <p className="mt-4 border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {todayActivityError}
                </p>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Orders Today</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--text-1)]">
                    {todayActivity.orders.toLocaleString("en-US")}
                  </p>
                </div>
                <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Units Sold Today</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--text-1)]">
                    {todayActivity.unitsSold.toLocaleString("en-US")}
                  </p>
                </div>
                <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Alerts Sent</p>
                  <p className="mt-2 text-3xl font-semibold text-emerald-300">
                    {todayActivity.alertsSent.toLocaleString("en-US")}
                  </p>
                </div>
                <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Alerts Failed</p>
                  <p className="mt-2 text-3xl font-semibold text-red-300">
                    {todayActivity.alertsFailed.toLocaleString("en-US")}
                  </p>
                </div>
              </div>
            </article>

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
        <section className="space-y-4">
          <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Orders</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">Recent Order Activity</h3>
                <p className="mt-2 text-sm text-[var(--text-2)]">
                  Last 30 days of order events and latest Telegram delivery state.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={orderStatusFilter}
                  onChange={(event) => {
                    const value = event.target.value;
                    setOrderStatusFilter(value);
                    setOrdersPage(1);
                    void loadOrders({ page: 1, status: value });
                  }}
                  className="h-10 border border-[var(--border-1)] bg-[var(--bg-0)] px-3 text-sm text-[var(--text-1)]"
                >
                  <option value="all">All statuses</option>
                  <option value="paid">Paid</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <button
                  type="button"
                  onClick={() => void loadOrders({ page: ordersPage, status: orderStatusFilter })}
                  disabled={ordersLoading}
                  className="inline-flex h-10 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:opacity-60"
                >
                  {ordersLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshSpinner />
                      Refreshing...
                    </span>
                  ) : (
                    "Refresh"
                  )}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Orders in Range</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-1)]">{ordersTotal.toLocaleString("en-US")}</p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Telegram Sent</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-300">
                  {orders.filter((order) => order.latestNotification?.status === "sent").length}
                </p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Telegram Failed</p>
                <p className="mt-2 text-3xl font-semibold text-red-300">
                  {orders.filter((order) => order.latestNotification?.status === "failed").length}
                </p>
              </div>
            </div>

            {ordersError ? (
              <p className="mt-4 border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{ordersError}</p>
            ) : null}

            <div className="mt-4 overflow-x-auto border border-[var(--border-1)]">
              <table className="min-w-full divide-y divide-[var(--border-1)] text-left">
                <thead className="bg-[var(--surface-2)]">
                  <tr>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Order</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Items</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Qty</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Created</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Status</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Total</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Sale Type</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Telegram</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Label</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-1)] bg-[var(--surface-1)]">
                  {ordersLoading && orders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-sm text-[var(--text-2)]">
                        Loading orders...
                      </td>
                    </tr>
                  ) : null}
                  {!ordersLoading && orders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-sm text-[var(--text-2)]">
                        No orders found for this filter.
                      </td>
                    </tr>
                  ) : null}
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="px-3 py-3 align-top">
                        <p className="font-mono text-sm font-semibold text-[var(--text-1)]">{order.mlOrderId}</p>
                        <p className="mt-1 text-xs text-[var(--text-3)]">
                          {order.lines.length} line{order.lines.length === 1 ? "" : "s"}
                        </p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        {order.lines.length === 0 ? (
                          <p className="text-sm text-[var(--text-3)]">N/A</p>
                        ) : (
                          <div className="space-y-1">
                            {order.lines.slice(0, 2).map((line) => (
                              <p key={`${order.id}:${line.mlItemId}`} className="max-w-[280px] truncate text-sm text-[var(--text-2)]">
                                {line.title}
                              </p>
                            ))}
                            {order.lines.length > 2 ? (
                              <p className="text-xs text-[var(--text-3)]">+{order.lines.length - 2} more</p>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top text-sm font-semibold text-[var(--text-1)]">
                        {order.lines.reduce((sum, line) => sum + line.quantity, 0).toLocaleString("en-US")}
                      </td>
                      <td className="px-3 py-3 align-top text-sm text-[var(--text-2)]">{formatDateTime(order.createdAtMl ?? order.createdAt)}</td>
                      <td className="px-3 py-3 align-top">
                        <span className={`inline-flex border px-2 py-1 text-xs font-semibold uppercase ${orderStatusTone(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top text-sm font-semibold text-[var(--text-1)]">
                        {order.totalAmount === null ? "N/A" : `$${order.totalAmount.toLocaleString("en-US")}`}
                      </td>
                      <td className="px-3 py-3 align-top text-sm text-[var(--text-2)]">{order.saleType ?? "N/A"}</td>
                      <td className="px-3 py-3 align-top">
                        <span
                          className={`inline-flex border px-2 py-1 text-xs font-semibold uppercase ${telegramStatusTone(
                            order.latestNotification?.status ?? null,
                          )}`}
                        >
                          {order.latestNotification?.status ?? "none"}
                        </span>
                        {order.latestNotification?.reason ? (
                          <p className="mt-1 text-xs text-[var(--text-3)]">{order.latestNotification.reason}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 align-top">
                        {order.labelUrl ? (
                          <a
                            href={order.labelUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center border border-[var(--accent)] bg-[var(--accent)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
                          >
                            Download
                          </a>
                        ) : (
                          <span className="text-xs text-[var(--text-3)]">Not ready</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-3)]">
                Page {ordersPage} of {ordersTotalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextPage = Math.max(1, ordersPage - 1);
                    setOrdersPage(nextPage);
                    void loadOrders({ page: nextPage, status: orderStatusFilter });
                  }}
                  disabled={ordersLoading || ordersPage <= 1}
                  className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextPage = Math.min(ordersTotalPages, ordersPage + 1);
                    setOrdersPage(nextPage);
                    void loadOrders({ page: nextPage, status: orderStatusFilter });
                  }}
                  disabled={ordersLoading || ordersPage >= ordersTotalPages}
                  className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      {activeTab === "stats" ? (
        <section className="space-y-4">
          <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                  Stats
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
                  Sales and inventory performance
                </h3>
                <p className="mt-1 text-sm text-[var(--text-2)]">
                  Last sync: {loading ? "Loading..." : formatRelativeTime(lastUpdatedAt)}
                </p>
              </div>
                <button
                  type="button"
                  onClick={() => void loadInventory()}
                  disabled={refreshing}
                  className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:opacity-60"
                >
                  {refreshing ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshSpinner />
                      Refreshing...
                    </span>
                  ) : (
                    "Refresh Stats"
                  )}
                </button>
            </div>
          </article>

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
                Total Units Sold
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-1)]">
                {totalUnitsSold.toLocaleString("en-US")}
              </p>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Lifetime units sold across the loaded catalog snapshot.
              </p>
            </article>
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Risk Rate
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-1)]">
                {riskRate}%
              </p>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Listings currently sold out, critical, or low on stock.
              </p>
            </article>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <article className="h-fit self-start overflow-hidden border border-[var(--border-1)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_55%),var(--surface-1)] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Top 3 Best Sellers
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-1)]">
                Top performers by units sold
              </h3>
              <p className="mt-2 max-w-xl text-sm text-[var(--text-2)]">
                Ranked from your current Mercado Libre catalog snapshot.
              </p>

              {topSellers.length > 0 ? (
                <div className="mt-6 grid gap-3 xl:grid-cols-3">
                  {topSellers.map((item, index) => {
                    const imageUrl = getItemImageUrl(item);
                    const rank = index + 1;

                    return (
                      <div key={item.id} className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                        <div className="flex items-start gap-3">
                          <span
                            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center border text-xs font-semibold ${topSellerRankTone(rank)}`}
                          >
                            #{rank}
                          </span>
                          <p className="line-clamp-2 text-sm font-semibold text-[var(--text-1)]">
                            {item.title ?? item.id}
                          </p>
                        </div>
                        {imageUrl ? (
                          <div className="mx-auto mt-3 flex h-28 w-28 items-center justify-center overflow-hidden border border-[var(--border-1)] bg-[var(--surface-2)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageUrl}
                              alt={item.title ?? item.id}
                              className="h-full w-full object-contain"
                              loading="lazy"
                            />
                          </div>
                        ) : null}
                        <div className="mt-3 space-y-2 text-xs text-[var(--text-2)]">
                          <div className="flex items-center justify-between">
                            <span>Units Sold</span>
                            <span className="font-semibold text-[var(--text-1)]">
                              {(item.sold_quantity ?? 0).toLocaleString("en-US")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Units On Hand</span>
                            <span className="font-semibold text-[var(--text-1)]">
                              {typeof item.available_quantity === "number"
                                ? item.available_quantity.toLocaleString("en-US")
                                : "Unknown"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Listing Value</span>
                            <span className="font-semibold text-[var(--text-1)]">
                              $
                              {typeof item.price === "number"
                                ? item.price.toLocaleString("en-US")
                                : "Unknown"}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 border border-[var(--border-1)] bg-[var(--surface-2)] px-2 py-1 font-mono text-[11px] text-[var(--text-3)]">
                          {item.id}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-6 border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                  <p className="text-sm text-[var(--text-2)]">
                    No `sold_quantity` data is available in the loaded catalog yet.
                  </p>
                </div>
              )}
            </article>

            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Catalog Health
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
                Snapshot of listing posture
              </h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Catalog Size</span>
                  <span className="text-sm font-semibold text-[var(--text-1)]">{items.length}</span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Active Listings</span>
                  <span className="text-sm font-semibold text-emerald-300">{activeItems}</span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Paused Listings</span>
                  <span className="text-sm font-semibold text-[var(--text-1)]">{pausedItems}</span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Healthy Listings</span>
                  <span className="text-sm font-semibold text-emerald-300">{healthyItems}</span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Sold Out Share</span>
                  <span className="text-sm font-semibold text-red-300">
                    {items.length === 0 ? "0%" : `${Math.round((soldOutItems / items.length) * 100)}%`}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Low Stock Share</span>
                  <span className="text-sm font-semibold text-amber-300">
                    {items.length === 0 ? "0%" : `${Math.round(((criticalItems + lowItems) / items.length) * 100)}%`}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Avg Units / Listing</span>
                  <span className="text-sm font-semibold text-[var(--text-1)]">
                    {averageUnitsPerListing.toLocaleString("en-US")}
                  </span>
                </div>
              </div>
            </article>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Fast Movers At Risk
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">
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
                    <div key={item.id} className="border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center border text-xs font-semibold ${topSellerRankTone(index + 1)}`}
                        >
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
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">
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
                    <div key={item.id} className="border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center border text-xs font-semibold ${topSellerRankTone(index + 1)}`}
                        >
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
                                      Math.max(dormantStock[0]?.available_quantity ?? item.available_quantity ?? 1, 1)) *
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
                Sell-Through Leaders
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">
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
                    <div key={item.id} className="border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                      <div className="flex items-start gap-3">
                        <span
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center border text-xs font-semibold ${topSellerRankTone(index + 1)}`}
                        >
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
        <section className="space-y-4">
          <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Alerts</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
                  Current alert posture
                </h3>
              </div>
              <Link
                href="/settings/notifications"
                className="inline-flex h-9 items-center border border-[var(--accent)] bg-[var(--accent)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
              >
                Alert Settings
              </Link>
            </div>

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
                <p className="mt-2 text-xs text-[var(--text-3)]">
                  Threshold:{" "}
                  {notificationSettings
                    ? `${notificationSettings.lowStockThreshold.toLocaleString("en-US")} units`
                    : "Checking"}
                </p>
              </div>
            </div>
          </article>
        </section>
      ) : null}
    </main>
  );
}
