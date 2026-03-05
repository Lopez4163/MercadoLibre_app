"use client";

import { useEffect, useState } from "react";
import InventoryTable from "../../../../components/dashboard/InventoryTable";
import NotificationSettingsCard from "../../../../components/dashboard/NotificationSettingsCard";

type InventoryItem = {
  id: string;
  title?: string;
  available_quantity?: number;
  price?: number;
  status?: string;
};

type InventoryResponse = {
  ok: boolean;
  error?: string;
  message?: string;
  items?: InventoryItem[];
};

export default function DashboardPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  async function loadInventory(options?: { initial?: boolean }) {
    const initial = options?.initial ?? false;

    try {
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      const response = await fetch("/api/ml/items", { cache: "no-store" });
      const data = (await response.json()) as InventoryResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? "Failed to fetch inventory");
      }

      setItems(data.items ?? []);
      setLastUpdatedAt(Date.now());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      if (initial) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    void loadInventory({ initial: true });
  }, []);

  const totalItems = items.length;
  const soldOutItems = items.filter((item) => item.available_quantity === 0).length;
  const criticalItems = items.filter(
    (item) => typeof item.available_quantity === "number" && item.available_quantity > 0 && item.available_quantity <= 3
  ).length;
  const lowItems = items.filter(
    (item) => typeof item.available_quantity === "number" && item.available_quantity > 3 && item.available_quantity <= 10
  ).length;
  const healthyItems = items.filter(
    (item) => typeof item.available_quantity === "number" && item.available_quantity > 20
  ).length;

  return (
    <main className="space-y-6">
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Executive Overview</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-1)] md:text-4xl">
              Inventory Performance
            </h2>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              Fast read of stock risk and alert posture across your catalog.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 border border-[var(--border-1)] bg-[var(--surface-1)] px-3 py-2">
            <span className="h-2 w-2 bg-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Live Sync</span>
          </div>
        </div>
      </section>

      {loading && (
        <div className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4 text-sm text-[var(--text-2)]">
          Loading inventory...
        </div>
      )}
      {error && (
        <div className="border border-[var(--danger)] bg-[var(--surface-2)] p-4 text-sm text-[var(--danger)]">
          Error: {error}
        </div>
      )}

      {!loading && (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4 xl:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Total</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-1)]">{totalItems}</p>
            </article>
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4 xl:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-300">Sold Out</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-red-200">{soldOutItems}</p>
            </article>
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4 xl:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">Critical</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-orange-200">{criticalItems}</p>
            </article>
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4 xl:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">Low</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-amber-200">{lowItems}</p>
            </article>
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4 xl:col-span-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Healthy</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-emerald-200">{healthyItems}</p>
            </article>
          </section>

          <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <InventoryTable
              items={items}
              refreshing={refreshing}
              lastUpdatedAt={lastUpdatedAt}
              onRefresh={() => void loadInventory()}
            />
            <div className="xl:sticky xl:top-24">
              <NotificationSettingsCard />
            </div>
          </section>
        </>
      )}
    </main>
  );
}
