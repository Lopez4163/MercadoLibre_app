"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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

type OrderRetryTelegramResponse = {
  ok?: boolean;
  sent?: boolean;
  reason?: string | null;
  error?: string;
  message?: string;
};

type TodayActivity = {
  orders: number;
  unitsSold: number;
  alertsSent: number;
  alertsFailed: number;
};

type TodaySummaryResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  summary?: TodayActivity;
};

type DashboardWorkspaceProps = {
  mlName: string;
  billingHasAccess: boolean;
  billingStatus: string;
};

type DashboardTab = "overview" | "inventory" | "orders" | "notifications" | "stats";

function formatRelativeTime(timestamp: number | null) {
  if (!timestamp) {
    return "Sin sincronizar";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function statusLabel(value: boolean | null) {
  if (value === null) {
    return "Verificando";
  }

  return value ? "Conectado" : "No conectado";
}

function statusTone(value: boolean | null) {
  if (value === null) {
    return "text-[var(--text-3)]";
  }

  return value ? "text-emerald-300" : "text-amber-300";
}

function toggleLabel(value: boolean | null) {
  if (value === null) {
    return "Verificando";
  }

  return value ? "Activo" : "Inactivo";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "No aplica";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "No aplica";
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

function billingStatusLabel(status: string) {
  if (status === "active") {
    return "activa";
  }
  if (status === "trialing") {
    return "en prueba";
  }
  if (status === "past_due") {
    return "pago pendiente";
  }
  if (status === "unpaid") {
    return "impaga";
  }
  if (status === "canceled") {
    return "cancelada";
  }
  return "sin estado";
}

const motionEase = [0.22, 1, 0.36, 1] as const;

const layoutStagger = {
  hidden: {},
  visible: {
    transition: {
      delayChildren: 0.04,
      staggerChildren: 0.06,
    },
  },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: motionEase },
  },
};

const tabTransition = {
  duration: 0.28,
  ease: motionEase,
} as const;

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
  const [retryingOrderId, setRetryingOrderId] = useState<string | null>(null);
  const [ordersRetryMessage, setOrdersRetryMessage] = useState<string | null>(null);
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
  const [telegramConnectBusy, setTelegramConnectBusy] = useState(false);
  const [telegramConnectPending, setTelegramConnectPending] = useState(false);
  const [telegramConnectedBanner, setTelegramConnectedBanner] = useState<string | null>(null);
  const [telegramNoticeDismissed, setTelegramNoticeDismissed] = useState(false);
  const inventoryBusy = loading || refreshing;
  const inventorySubscriptionLocked =
    Boolean(inventoryError) &&
    (inventoryError?.toLowerCase().includes("active subscription required") ||
      inventoryError?.toLowerCase().includes("subscription_required"));
  const showInventorySubscriptionCta = inventorySubscriptionLocked && !billingHasAccess;
  const telegramConnectionRequired = billingHasAccess && telegramConnected === false;
  const showTelegramConnectionNotice = telegramConnectionRequired && !telegramNoticeDismissed;

  useEffect(() => {
    if (!telegramConnectionRequired) {
      setTelegramNoticeDismissed(false);
    }
  }, [telegramConnectionRequired]);

  const handleQuickTelegramConnect = useCallback(async () => {
    if (telegramConnectBusy) {
      return;
    }

    setTelegramConnectBusy(true);
    setTelegramConnectPending(true);
    try {
      const response = await fetch("/api/telegram/connect", { cache: "no-store" });
      const data = (await response.json()) as {
        ok?: boolean;
        connectUrl?: string | null;
        error?: string;
        requiresBotUsername?: boolean;
      };

      if (!response.ok || !data.ok || !data.connectUrl) {
        throw new Error(data.error ?? "failed_to_create_connect_link");
      }

      window.open(data.connectUrl, "_blank", "noopener,noreferrer");
    } catch {
      setTelegramConnectPending(false);
      window.location.assign("/settings/telegram");
    } finally {
      setTelegramConnectBusy(false);
    }
  }, [telegramConnectBusy]);

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
        throw new Error(data.message ?? data.error ?? "Fallo al cargar inventario");
      }

      setItems(data.items ?? []);
      setLastUpdatedAt(Date.now());
    } catch (error) {
      setInventoryError(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      if (initial) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }

  const loadTelegramStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/telegram/status", { cache: "no-store" });
      const data = (await response.json()) as { ok?: boolean; connected?: boolean };

      if (!response.ok || !data.ok) {
        throw new Error("failed_to_load_telegram_status");
      }

      const connected = Boolean(data.connected);
      setTelegramConnected((previous) => {
        if (connected && previous !== true && telegramConnectPending) {
          setTelegramConnectedBanner("Telegram conectado.");
          setTelegramConnectPending(false);
        }
        return connected;
      });
    } catch {
      setTelegramConnected(false);
    }
  }, [telegramConnectPending]);

  useEffect(() => {
    if (!telegramConnectedBanner) {
      return;
    }

    const timer = window.setTimeout(() => {
      setTelegramConnectedBanner(null);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [telegramConnectedBanner]);

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
        throw new Error(data.message ?? data.error ?? "Fallo al cargar pedidos");
      }

      setOrders(data.orders ?? []);
      setOrdersPage(data.pagination?.page ?? page);
      setOrdersTotalPages(data.pagination?.totalPages ?? 1);
      setOrdersTotal(data.pagination?.total ?? 0);
      setOrdersLoadedOnce(true);
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setOrdersLoading(false);
    }
  }, [orderStatusFilter, ordersPage]);

  const loadTodayActivity = useCallback(async () => {
    try {
      setTodayActivityLoading(true);
      setTodayActivityError(null);
      const response = await fetch("/api/orders/today-summary", { cache: "no-store" });
      const data = (await response.json()) as TodaySummaryResponse;

      if (!response.ok || !data.ok || !data.summary) {
        throw new Error(data.message ?? data.error ?? "Fallo al cargar actividad de hoy");
      }

      setTodayActivity(data.summary);
    } catch (error) {
      setTodayActivityError(error instanceof Error ? error.message : "Error desconocido");
    } finally {
      setTodayActivityLoading(false);
    }
  }, []);

  const retryOrderTelegramNotification = useCallback(async (orderId: string) => {
    if (retryingOrderId) {
      return;
    }

    try {
      setRetryingOrderId(orderId);
      setOrdersRetryMessage(null);

      const response = await fetch(`/api/orders/${orderId}/retry-telegram`, {
        method: "POST",
      });
      const data = (await response.json()) as OrderRetryTelegramResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Fallo al reintentar alerta de Telegram");
      }

      if (!data.sent) {
        const reason = data.reason ?? "retry_failed";
        throw new Error(`Reintento fallido: ${reason}`);
      }

      setOrdersRetryMessage("Alerta de Telegram reenviada.");
      await Promise.all([
        loadOrders({ page: ordersPage, status: orderStatusFilter }),
        loadTodayActivity(),
      ]);
    } catch (error) {
      setOrdersRetryMessage(error instanceof Error ? error.message : "Fallo al reintentar alerta de Telegram");
    } finally {
      setRetryingOrderId(null);
    }
  }, [loadOrders, loadTodayActivity, orderStatusFilter, ordersPage, retryingOrderId]);

  useEffect(() => {
    void Promise.all([
      loadInventory({ initial: true }),
      loadTelegramStatus(),
      loadNotificationSettings(),
      loadTodayActivity(),
    ]);
  }, [loadTelegramStatus, loadTodayActivity]);

  useEffect(() => {
    const onFocus = () => {
      void loadTelegramStatus();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadTelegramStatus();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [loadTelegramStatus]);

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
    `inline-flex h-11 cursor-pointer items-center border px-4 text-sm font-semibold transition-all duration-150 active:translate-y-px active:scale-[0.99] ${
      activeTab === tab
        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] hover:brightness-110 active:brightness-95"
        : "border-[var(--border-1)] bg-[var(--surface-1)] text-[var(--text-1)] hover:border-[var(--text-2)] hover:bg-[var(--surface-2)] active:bg-[var(--bg-0)]"
    }`;

  return (
    <motion.main className="space-y-6" variants={layoutStagger} initial="hidden" animate="visible">
      <motion.section className="space-y-3" variants={fadeInUp}>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
          Panel
        </p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-1)] md:text-4xl">
              Panel de control vendedor
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-2)]">
              Vista operativa en vivo para riesgo de inventario, disponibilidad de entrega y la siguiente accion del equipo.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2">
            <span className={`h-2 w-2 ${billingHasAccess ? "bg-emerald-400" : "bg-red-400"}`} />
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
              Facturacion {billingStatusLabel(billingStatus)}
            </span>
          </div>
        </div>
      </motion.section>

      <motion.section className="flex flex-wrap gap-3" variants={fadeInUp}>
        <button type="button" className={tabClass("overview")} onClick={() => setActiveTab("overview")}>
          Resumen
        </button>
        <button type="button" className={tabClass("inventory")} onClick={() => setActiveTab("inventory")}>
          Inventario
        </button>
        <button type="button" className={tabClass("orders")} onClick={() => setActiveTab("orders")}>
          Pedidos
        </button>
        <button type="button" className={tabClass("stats")} onClick={() => setActiveTab("stats")}>
          Estadisticas
        </button>
        <button type="button" className={tabClass("notifications")} onClick={() => setActiveTab("notifications")}>
          Notificaciones
        </button>
      </motion.section>

      <AnimatePresence initial={false} mode="popLayout">
        {inventoryError ? (
          showInventorySubscriptionCta ? (
            <motion.section
              key="billing-trial-cta"
              className="overflow-hidden border border-yellow-300/80 bg-yellow-300/20 p-5"
              initial={{ opacity: 0, y: -56 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -28 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Facturacion requerida</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
                Inicia tu prueba gratis para activar sincronizacion de inventario y notificaciones de Telegram
              </h3>
              <p className="mt-2 max-w-2xl text-sm text-yellow-50">
                Activa refresco de inventario, reglas de alerta y monitoreo de pedidos despues de activar la prueba.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/billing?intent=trial"
                  className="inline-flex h-10 min-w-[160px] items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] transition-all duration-150 hover:bg-transparent hover:text-[var(--text-1)] active:translate-y-px active:scale-[0.99] active:bg-[var(--bg-0)]"
                >
                  Iniciar prueba gratis
                </Link>
                <Link
                  href="/settings/billing"
                  className="inline-flex h-10 min-w-[160px] items-center justify-center border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text-1)] transition-all duration-150 hover:border-[var(--text-2)] hover:bg-[var(--surface-1)] active:translate-y-px active:scale-[0.99] active:bg-[var(--bg-0)]"
                >
                  Ir a facturacion
                </Link>
              </div>
            </motion.section>
          ) : (
            <motion.div
              key="inventory-error"
              className="border border-[var(--danger)] bg-[var(--surface-2)] p-4 text-sm text-[var(--danger)]"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: motionEase }}
            >
              Error: {inventoryError}
            </motion.div>
          )
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {telegramConnectedBanner ? (
          <motion.div
            key="telegram-connected-banner"
            className="border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            {telegramConnectedBanner}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tabTransition}
      >
      {activeTab === "overview" ? (
        <motion.section
          className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]"
          layout
          transition={{ layout: { duration: 0.28, ease: motionEase } }}
        >
          <AnimatePresence initial={false}>
            {showTelegramConnectionNotice ? (
            <motion.div
              key="overview-telegram-required"
              className="xl:col-span-2 border border-yellow-300/80 bg-yellow-300/20 p-5"
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.24, ease: motionEase }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                  Telegram requerido
                </p>
                <button
                  type="button"
                  onClick={() => setTelegramNoticeDismissed(true)}
                  className="inline-flex h-7 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-2)] transition-colors hover:border-[var(--text-2)] hover:bg-[var(--surface-1)]"
                >
                  Cerrar
                </button>
              </div>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
                Conecta Telegram para empezar a recibir alertas
              </h3>
              <p className="mt-2 max-w-2xl text-sm text-yellow-50">
                Tus reglas de notificacion estan listas. Vincula Telegram para habilitar entrega en alertas de venta, agotado y bajo stock.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleQuickTelegramConnect()}
                  disabled={telegramConnectBusy}
                  className="inline-flex h-10 items-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
                >
                  {telegramConnectBusy ? "Abriendo..." : "Conectar Telegram"}
                </button>
              </div>
            </motion.div>
          ) : null}
          </AnimatePresence>

          <motion.div className="space-y-4" layout transition={{ layout: { duration: 0.28, ease: motionEase } }}>
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                    Rendimiento de inventario
                  </p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
                    Estado de stock de un vistazo
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => void loadInventory()}
                  disabled={inventoryBusy || !billingHasAccess}
                  className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:opacity-60"
                >
                  {inventoryBusy ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshSpinner />
                      Actualizando...
                    </span>
                  ) : (
                    "Actualizar"
                  )}
                </button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="border border-red-500/50 bg-red-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Agotado</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-red-200">
                    {billingHasAccess ? soldOutItems : "Bloqueado"}
                  </p>
                </div>
                <div className="border border-orange-500/50 bg-orange-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">Critico</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-orange-200">
                    {billingHasAccess ? criticalItems : "Bloqueado"}
                  </p>
                </div>
                <div className="border border-amber-500/50 bg-amber-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Bajo</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-amber-200">
                    {billingHasAccess ? lowItems : "Bloqueado"}
                  </p>
                </div>
                <div className="border border-emerald-500/50 bg-emerald-500/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Saludable</p>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-emerald-200">
                    {billingHasAccess ? healthyItems : "Bloqueado"}
                  </p>
                </div>
              </div>
            </article>

            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                    Los 3 mas vendidos
                  </p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">
                    Resumen por unidades vendidas
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("stats")}
                  className="inline-flex h-8 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)]"
                >
                  Ver estadisticas completas
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {topSellers.length === 0 ? (
                  <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                    <p className="text-sm text-[var(--text-2)]">Aun no hay datos de ventas.</p>
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
                        Vendidas:{" "}
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
                  Estado de notificaciones
                </p>
                {telegramConnectionRequired ? (
                  <button
                    type="button"
                    onClick={() => void handleQuickTelegramConnect()}
                    disabled={telegramConnectBusy}
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-3)] hover:text-[var(--text-1)] disabled:opacity-60"
                  >
                    {telegramConnectBusy ? "Abriendo..." : "Conectar Telegram"}
                  </button>
                ) : (
                  <Link
                    href="/settings/notifications"
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-3)] hover:text-[var(--text-1)]"
                  >
                    Editar
                  </Link>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Cada venta</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--text-1)]">
                    {billingHasAccess ? toggleLabel(notificationSettings?.notifyEverySale ?? null) : "Bloqueado"}
                  </p>
                </div>
                <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Agotado</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--text-1)]">
                    {billingHasAccess ? toggleLabel(notificationSettings?.notifySoldOut ?? null) : "Bloqueado"}
                  </p>
                </div>
                <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Stock bajo</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--text-1)]">
                    {billingHasAccess ? toggleLabel(notificationSettings?.notifyLowStock ?? null) : "Bloqueado"}
                  </p>
                </div>
                <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Umbral</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--text-1)]">
                    {billingHasAccess ? (notificationSettings ? notificationSettings.lowStockThreshold : "Verificando") : "Bloqueado"}
                  </p>
                </div>
              </div>
            </article>
          </motion.div>

          <div className="grid gap-4">
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                    Actividad de hoy
                  </p>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">
                    Pulso operativo diario
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => void loadTodayActivity()}
                  disabled={todayActivityLoading || !billingHasAccess}
                  className="inline-flex h-8 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:opacity-60"
                >
                  {todayActivityLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshSpinner />
                      Actualizando...
                    </span>
                  ) : (
                    "Actualizar"
                  )}
                </button>
              </div>

              {todayActivityError && billingHasAccess ? (
                <p className="mt-4 border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {todayActivityError}
                </p>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Pedidos de hoy</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--text-1)]">
                    {billingHasAccess ? todayActivity.orders.toLocaleString("en-US") : "Bloqueado"}
                  </p>
                </div>
                <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Unidades vendidas hoy</p>
                  <p className="mt-2 text-3xl font-semibold text-[var(--text-1)]">
                    {billingHasAccess ? todayActivity.unitsSold.toLocaleString("en-US") : "Bloqueado"}
                  </p>
                </div>
                <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Alertas enviadas</p>
                  <p className="mt-2 text-3xl font-semibold text-emerald-300">
                    {billingHasAccess ? todayActivity.alertsSent.toLocaleString("en-US") : "Bloqueado"}
                  </p>
                </div>
                <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Alertas fallidas</p>
                  <p className="mt-2 text-3xl font-semibold text-red-300">
                    {billingHasAccess ? todayActivity.alertsFailed.toLocaleString("en-US") : "Bloqueado"}
                  </p>
                </div>
              </div>
            </article>

            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Estado operativo
              </p>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Mercado Libre</span>
                  <span className="text-sm font-semibold text-emerald-300">Conectado</span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Telegram</span>
                  <span className={`text-sm font-semibold ${statusTone(telegramConnected)}`}>
                    {statusLabel(telegramConnected)}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Nombre ML</span>
                  <span className="text-sm font-semibold text-[var(--text-1)]">{mlName}</span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Ultima sincronizacion</span>
                  <span className="text-sm font-semibold text-[var(--text-1)]">
                    {loading ? "Cargando..." : formatRelativeTime(lastUpdatedAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Tamano de catalogo</span>
                  <span className="text-sm font-semibold text-[var(--text-1)]">
                    {loading ? "Cargando..." : items.length}
                  </span>
                </div>
              </div>
            </article>

          </div>

        </motion.section>
      ) : null}

      {activeTab === "inventory" ? (
        <motion.section
          className="space-y-4"
        >
          <div className="grid gap-3 md:grid-cols-5">
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Total de items</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-1)]">
                {billingHasAccess ? items.length : "Bloqueado"}
              </p>
            </article>
            <article className="border border-red-500/50 bg-red-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Agotados</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-red-200">
                {billingHasAccess ? soldOutItems : "Bloqueado"}
              </p>
            </article>
            <article className="border border-orange-500/50 bg-orange-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">Critico</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-orange-200">
                {billingHasAccess ? criticalItems : "Bloqueado"}
              </p>
            </article>
            <article className="border border-amber-500/50 bg-amber-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Bajo</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-amber-200">
                {billingHasAccess ? lowItems : "Bloqueado"}
              </p>
            </article>
            <article className="border border-emerald-500/50 bg-emerald-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Saludable</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-emerald-200">
                {billingHasAccess ? healthyItems : "Bloqueado"}
              </p>
            </article>
          </div>

          <InventoryTable
            items={items}
            refreshing={refreshing}
            lastUpdatedAt={lastUpdatedAt}
            onRefresh={() => void loadInventory()}
            refreshDisabled={!billingHasAccess}
          />
        </motion.section>
      ) : null}

      {activeTab === "orders" ? (
        <motion.section
          className="space-y-4"
        >
          <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Pedidos</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">Actividad reciente de pedidos</h3>
                <p className="mt-2 text-sm text-[var(--text-2)]">
                  Ultimos 30 dias de eventos de pedidos y ultimo estado de entrega en Telegram.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={orderStatusFilter}
                  disabled={!billingHasAccess}
                  onChange={(event) => {
                    if (!billingHasAccess) {
                      return;
                    }
                    const value = event.target.value;
                    setOrderStatusFilter(value);
                    setOrdersPage(1);
                    void loadOrders({ page: 1, status: value });
                  }}
                  className="h-10 border border-[var(--border-1)] bg-[var(--bg-0)] px-3 text-sm text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="all">Todos los estados</option>
                  <option value="paid">Pagado</option>
                  <option value="confirmed">Confirmado</option>
                  <option value="cancelled">Cancelado</option>
                </select>
                <button
                  type="button"
                  onClick={() => void loadOrders({ page: ordersPage, status: orderStatusFilter })}
                  disabled={ordersLoading || !billingHasAccess}
                  className="inline-flex h-10 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:opacity-60"
                >
                  {ordersLoading ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshSpinner />
                      Actualizando...
                    </span>
                  ) : (
                    "Actualizar"
                  )}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Pedidos en rango</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-1)]">
                  {billingHasAccess ? ordersTotal.toLocaleString("en-US") : "Bloqueado"}
                </p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Telegram enviado</p>
                <p className="mt-2 text-3xl font-semibold text-emerald-300">
                  {billingHasAccess
                    ? orders.filter((order) => order.latestNotification?.status === "sent").length
                    : "Bloqueado"}
                </p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Telegram fallido</p>
                <p className="mt-2 text-3xl font-semibold text-red-300">
                  {billingHasAccess
                    ? orders.filter((order) => order.latestNotification?.status === "failed").length
                    : "Bloqueado"}
                </p>
              </div>
            </div>

            {ordersError && billingHasAccess ? (
              <p className="mt-4 border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{ordersError}</p>
            ) : null}
            {ordersRetryMessage ? (
              <p className="mt-4 border border-[var(--border-1)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-2)]">
                {ordersRetryMessage}
              </p>
            ) : null}

            <div className="mt-4 overflow-x-auto border border-[var(--border-1)]">
              <table className="min-w-full divide-y divide-[var(--border-1)] text-left">
                <thead className="bg-[var(--surface-2)]">
                  <tr>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Pedido</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Articulos</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Cant.</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Creado</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Estado</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Total</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Tipo de venta</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Telegram</th>
                    <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Etiqueta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-1)] bg-[var(--surface-1)]">
                  {ordersLoading && orders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-sm text-[var(--text-2)]">
                        Cargando pedidos...
                      </td>
                    </tr>
                  ) : null}
                  {!ordersLoading && orders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-sm text-[var(--text-2)]">
                        No se encontraron pedidos para este filtro.
                      </td>
                    </tr>
                  ) : null}
                  {orders.map((order) => (
                    <tr key={order.id}>
                          <td className="px-3 py-3 align-top">
                            <p className="font-mono text-sm font-semibold text-[var(--text-1)]">{order.mlOrderId}</p>
                            <p className="mt-1 text-xs text-[var(--text-3)]">
                              {order.lines.length} linea{order.lines.length === 1 ? "" : "s"}
                            </p>
                          </td>
                          <td className="px-3 py-3 align-top">
                            {order.lines.length === 0 ? (
                              <p className="text-sm text-[var(--text-3)]">No aplica</p>
                            ) : (
                              <div className="space-y-1">
                                {order.lines.slice(0, 2).map((line) => (
                                  <p key={`${order.id}:${line.mlItemId}`} className="max-w-[280px] truncate text-sm text-[var(--text-2)]">
                                    {line.title}
                                  </p>
                                ))}
                                {order.lines.length > 2 ? (
                                  <p className="text-xs text-[var(--text-3)]">+{order.lines.length - 2} mas</p>
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
                            {order.totalAmount === null ? "No aplica" : `$${order.totalAmount.toLocaleString("en-US")}`}
                          </td>
                          <td className="px-3 py-3 align-top text-sm text-[var(--text-2)]">{order.saleType ?? "No aplica"}</td>
                          <td className="px-3 py-3 align-top">
                            <AnimatePresence mode="wait" initial={false}>
                              <motion.span
                                key={`${order.id}:${order.latestNotification?.status ?? "none"}`}
                                initial={{ opacity: 0, y: -4, filter: "blur(2px)" }}
                                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                exit={{ opacity: 0, y: 4, filter: "blur(2px)" }}
                                transition={{ duration: 0.28, ease: motionEase }}
                                className={`inline-flex border px-2 py-1 text-xs font-semibold uppercase ${telegramStatusTone(
                                  order.latestNotification?.status ?? null,
                                )}`}
                              >
                                {order.latestNotification?.status ?? "sin envio"}
                              </motion.span>
                            </AnimatePresence>
                            {order.latestNotification?.reason ? (
                              <p className="mt-1 text-xs text-[var(--text-3)]">{order.latestNotification.reason}</p>
                            ) : null}
                            {order.latestNotification?.status === "failed" &&
                            order.latestNotification?.eventType === "order_sold" ? (
                              <button
                                type="button"
                                disabled={retryingOrderId === order.id || ordersLoading || !billingHasAccess}
                                onClick={() => void retryOrderTelegramNotification(order.id)}
                                className="mt-2 inline-flex h-7 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:opacity-50"
                              >
                                {retryingOrderId === order.id ? "Reintentando..." : "Reintentar"}
                              </button>
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
                                Descargar
                              </a>
                            ) : (
                              <span className="text-xs text-[var(--text-3)]">No lista</span>
                            )}
                          </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-3)]">
                Pagina {ordersPage} de {ordersTotalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextPage = Math.max(1, ordersPage - 1);
                    setOrdersPage(nextPage);
                    void loadOrders({ page: nextPage, status: orderStatusFilter });
                  }}
                  disabled={ordersLoading || !billingHasAccess || ordersPage <= 1}
                  className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextPage = Math.min(ordersTotalPages, ordersPage + 1);
                    setOrdersPage(nextPage);
                    void loadOrders({ page: nextPage, status: orderStatusFilter });
                  }}
                  disabled={ordersLoading || !billingHasAccess || ordersPage >= ordersTotalPages}
                  className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </article>
        </motion.section>
      ) : null}

      {activeTab === "stats" ? (
        <motion.section
          className="space-y-4"
        >
          <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                  Estadisticas
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
                  Rendimiento de ventas e inventario
                </h3>
                <p className="mt-1 text-sm text-[var(--text-2)]">
                  Ultima sincronizacion: {loading ? "Cargando..." : formatRelativeTime(lastUpdatedAt)}
                </p>
              </div>
                <button
                  type="button"
                  onClick={() => void loadInventory()}
                  disabled={inventoryBusy || !billingHasAccess}
                  className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:opacity-60"
                >
                  {inventoryBusy ? (
                    <span className="inline-flex items-center gap-2">
                      <RefreshSpinner />
                      Actualizando...
                    </span>
                  ) : (
                    "Actualizar estadisticas"
                  )}
                </button>
            </div>
          </article>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Valor del inventario
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-1)]">
                {billingHasAccess ? `$${inventoryValue.toLocaleString("en-US")}` : "Bloqueado"}
              </p>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Estimado segun precio actual de publicacion x unidades disponibles.
              </p>
            </article>
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Unidades en stock
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-1)]">
                {billingHasAccess ? totalUnitsOnHand.toLocaleString("en-US") : "Bloqueado"}
              </p>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Cantidad disponible total en las publicaciones cargadas.
              </p>
            </article>
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Unidades vendidas total
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-1)]">
                {billingHasAccess ? totalUnitsSold.toLocaleString("en-US") : "Bloqueado"}
              </p>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Unidades vendidas historicas en el catalogo cargado.
              </p>
            </article>
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Tasa de riesgo
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-1)]">
                {billingHasAccess ? `${riskRate}%` : "Bloqueado"}
              </p>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Publicaciones actualmente agotadas, criticas o con stock bajo.
              </p>
            </article>
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
            <article className="h-fit self-start overflow-hidden border border-[var(--border-1)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_55%),var(--surface-1)] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Los 3 mas vendidos
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-1)]">
                Productos lideres por unidades vendidas
              </h3>
              <p className="mt-2 max-w-xl text-sm text-[var(--text-2)]">
                Ordenado segun tu catalogo actual de Mercado Libre.
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
                            <span>Unidades vendidas</span>
                            <span className="font-semibold text-[var(--text-1)]">
                              {(item.sold_quantity ?? 0).toLocaleString("en-US")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Unidades en stock</span>
                            <span className="font-semibold text-[var(--text-1)]">
                              {typeof item.available_quantity === "number"
                                ? item.available_quantity.toLocaleString("en-US")
                                : "Desconocido"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Valor publicado</span>
                            <span className="font-semibold text-[var(--text-1)]">
                              $
                              {typeof item.price === "number"
                                ? item.price.toLocaleString("en-US")
                                : "Desconocido"}
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
                    {billingHasAccess
                      ? "Aun no hay datos de cantidad vendida en el catalogo cargado."
                      : "Bloqueado. Inicia tu prueba gratis para desbloquear insights de mas vendidos."}
                  </p>
                </div>
              )}
            </article>

            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Salud del catalogo
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
                Estado actual de publicaciones
              </h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Tamano del catalogo</span>
                  <span className="text-sm font-semibold text-[var(--text-1)]">
                    {billingHasAccess ? items.length : "Bloqueado"}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Publicaciones activas</span>
                  <span className="text-sm font-semibold text-emerald-300">
                    {billingHasAccess ? activeItems : "Bloqueado"}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Publicaciones pausadas</span>
                  <span className="text-sm font-semibold text-[var(--text-1)]">
                    {billingHasAccess ? pausedItems : "Bloqueado"}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Publicaciones saludables</span>
                  <span className="text-sm font-semibold text-emerald-300">
                    {billingHasAccess ? healthyItems : "Bloqueado"}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Porcentaje agotado</span>
                  <span className="text-sm font-semibold text-red-300">
                    {billingHasAccess
                      ? items.length === 0
                        ? "0%"
                        : `${Math.round((soldOutItems / items.length) * 100)}%`
                      : "Bloqueado"}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Porcentaje bajo stock</span>
                  <span className="text-sm font-semibold text-amber-300">
                    {billingHasAccess
                      ? items.length === 0
                        ? "0%"
                        : `${Math.round(((criticalItems + lowItems) / items.length) * 100)}%`
                      : "Bloqueado"}
                  </span>
                </div>
                <div className="flex items-center justify-between border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <span className="text-sm text-[var(--text-2)]">Promedio de unidades / publicacion</span>
                  <span className="text-sm font-semibold text-[var(--text-1)]">
                    {billingHasAccess ? averageUnitsPerListing.toLocaleString("en-US") : "Bloqueado"}
                  </span>
                </div>
              </div>
            </article>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                Mas vendidos en riesgo
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">
                Productos populares con poco stock
              </h3>
              <div className="mt-4 space-y-3">
                {!billingHasAccess ? (
                  <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                    <p className="text-sm text-[var(--text-2)]">
                      Bloqueado. Inicia tu prueba gratis para desbloquear insights de riesgo en mas vendidos.
                    </p>
                  </div>
                ) : fastMoversAtRisk.length === 0 ? (
                  <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                    <p className="text-sm text-[var(--text-2)]">
                      No hay publicaciones muy vendidas con stock bajo en el catalogo cargado.
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
                            <span>Vendidas: {(item.sold_quantity ?? 0).toLocaleString("en-US")}</span>
                            <span>
                              Stock:{" "}
                              {typeof item.available_quantity === "number"
                                ? item.available_quantity.toLocaleString("en-US")
                                : "Desconocido"}
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
                Stock sin movimiento
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">
                Inventario sin ventas
              </h3>
              <div className="mt-4 space-y-3">
                {!billingHasAccess ? (
                  <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                    <p className="text-sm text-[var(--text-2)]">
                      Bloqueado. Inicia tu prueba gratis para desbloquear insights de stock sin movimiento.
                    </p>
                  </div>
                ) : dormantStock.length === 0 ? (
                  <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                    <p className="text-sm text-[var(--text-2)]">
                      No hay stock inactivo destacado en el catalogo cargado.
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
                            <span>Vendidas: {(item.sold_quantity ?? 0).toLocaleString("en-US")}</span>
                            <span>
                              Stock:{" "}
                              {typeof item.available_quantity === "number"
                                ? item.available_quantity.toLocaleString("en-US")
                                : "Desconocido"}
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
                Lideres en rotacion
              </p>
              <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">
                Publicaciones con mejor rotacion
              </h3>
              <div className="mt-4 space-y-3">
                {!billingHasAccess ? (
                  <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                    <p className="text-sm text-[var(--text-2)]">
                      Bloqueado. Inicia tu prueba gratis para desbloquear insights de lideres en rotacion.
                    </p>
                  </div>
                ) : sellThroughLeaders.length === 0 ? (
                  <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                    <p className="text-sm text-[var(--text-2)]">
                      No se pueden calcular lideres en rotacion con el catalogo cargado.
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
                            <span>Rotacion: {Math.round(item.sellThroughRate * 100)}%</span>
                            <span>Vendidas: {(item.sold_quantity ?? 0).toLocaleString("en-US")}</span>
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
        </motion.section>
      ) : null}

      {activeTab === "notifications" ? (
        <motion.section
          className="space-y-4"
          layout
          transition={{ layout: { duration: 0.28, ease: motionEase } }}
        >
          <AnimatePresence initial={false}>
            {showTelegramConnectionNotice ? (
            <motion.section
              key="notifications-telegram-required"
              className="border border-yellow-300/80 bg-yellow-300/20 p-5"
              layout
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.24, ease: motionEase }}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
                  Telegram requerido
                </p>
                <button
                  type="button"
                  onClick={() => setTelegramNoticeDismissed(true)}
                  className="inline-flex h-7 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-2)] transition-colors hover:border-[var(--text-2)] hover:bg-[var(--surface-1)]"
                >
                  Cerrar
                </button>
              </div>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
                Conecta Telegram para empezar a recibir alertas
              </h3>
              <p className="mt-2 max-w-2xl text-sm text-yellow-50">
                Las reglas de notificacion estan listas. Vincula Telegram para entregar mensajes de venta, agotado y bajo stock.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleQuickTelegramConnect()}
                  disabled={telegramConnectBusy}
                  className="inline-flex h-10 items-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
                >
                  {telegramConnectBusy ? "Abriendo..." : "Conectar Telegram"}
                </button>
              </div>
            </motion.section>
          ) : null}
          </AnimatePresence>

          <motion.article
            className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5"
            layout
            transition={{ layout: { duration: 0.28, ease: motionEase } }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Notificaciones</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">
                  Configuracion de notificaciones
                </h3>
              </div>
              {telegramConnectionRequired ? (
                <button
                  type="button"
                  onClick={() => void handleQuickTelegramConnect()}
                  disabled={telegramConnectBusy}
                  className="inline-flex h-9 items-center border border-[var(--accent)] bg-[var(--accent)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)] disabled:opacity-60"
                >
                  {telegramConnectBusy ? "Abriendo..." : "Conectar Telegram"}
                </button>
              ) : (
                <Link
                  href="/settings/notifications"
                  className="inline-flex h-9 items-center border border-[var(--accent)] bg-[var(--accent)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
                >
                  Configuracion de notificaciones
                </Link>
              )}
            </div>

            <div
              className={`mt-5 grid gap-3 sm:grid-cols-2 ${
                telegramConnectionRequired ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Cada venta</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-1)]">
                  {billingHasAccess ? toggleLabel(notificationSettings?.notifyEverySale ?? null) : "Bloqueado"}
                </p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Telegram</p>
                <p className={`mt-2 text-3xl font-semibold ${statusTone(telegramConnected)}`}>
                  {statusLabel(telegramConnected)}
                </p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Regla de agotado</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-1)]">
                  {billingHasAccess ? toggleLabel(notificationSettings?.notifySoldOut ?? null) : "Bloqueado"}
                </p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--bg-0)] p-4">
                <p className="text-xs uppercase tracking-wide text-[var(--text-3)]">Regla de bajo stock</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--text-1)]">
                  {billingHasAccess ? toggleLabel(notificationSettings?.notifyLowStock ?? null) : "Bloqueado"}
                </p>
                <p className="mt-2 text-xs text-[var(--text-3)]">
                  Umbral:{" "}
                  {billingHasAccess
                    ? notificationSettings
                      ? `${notificationSettings.lowStockThreshold.toLocaleString("en-US")} unidades`
                      : "Verificando"
                    : "Bloqueado"}
                </p>
              </div>
            </div>
          </motion.article>
        </motion.section>
      ) : null}
      </motion.div>
    </motion.main>
  );
}
