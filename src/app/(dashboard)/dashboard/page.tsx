"use client";

import { useEffect, useState } from "react";
import InventoryTable from "../../../../components/dashboard/InventoryTable";

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadInventory() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/ml/items", { cache: "no-store" });
        const data = (await response.json()) as InventoryResponse;

        if (!response.ok || !data.ok) {
          throw new Error(data.message ?? data.error ?? "Failed to fetch inventory");
        }

        if (mounted) {
          setItems(data.items ?? []);
        }
      } catch (err) {
        if (mounted) {
          const message = err instanceof Error ? err.message : "Unknown error";
          setError(message);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadInventory();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <main>
      {loading && <p className="text-sm text-slate-600">Loading inventory...</p>}
      {error && <p className="text-sm text-red-600">Error: {error}</p>}

      {!loading && !error && <InventoryTable items={items} />}
    </main>
  );
}
