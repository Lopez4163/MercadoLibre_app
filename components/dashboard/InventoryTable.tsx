"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import InventorySearchBar from "./InventorySearchBar";

type InventoryItem = {
  id: string;
  title?: string;
  available_quantity?: number;
  price?: number;
  status?: string;
};

type InventoryTableProps = {
  items: InventoryItem[];
  refreshing: boolean;
  lastUpdatedAt: number | null;
  onRefresh: () => void;
  refreshDisabled?: boolean;
};

type SortOption = "stock_asc" | "stock_desc" | "price_asc" | "price_desc";

function compareNullableNumbers(a?: number, b?: number, direction: "asc" | "desc" = "asc") {
  const aIsNumber = typeof a === "number";
  const bIsNumber = typeof b === "number";

  if (!aIsNumber && !bIsNumber) {
    return 0;
  }

  if (!aIsNumber) {
    return 1;
  }

  if (!bIsNumber) {
    return -1;
  }

  if (direction === "asc") {
    return a - b;
  }

  return b - a;
}

function getStockLevel(stock?: number) {
  if (typeof stock !== "number") {
    return {
      label: "Unknown",
      containerClass: "border-[var(--border-1)] bg-[var(--surface-2)] text-[var(--text-2)]",
      dotClass: "bg-[var(--text-3)]",
    };
  }

  if (stock <= 3) {
    return {
      label: "Critical",
      containerClass: "border-red-500/60 bg-red-500/10 text-red-300",
      dotClass: "bg-red-400",
    };
  }

  if (stock <= 10) {
    return {
      label: "Low",
      containerClass: "border-orange-500/60 bg-orange-500/10 text-orange-300",
      dotClass: "bg-orange-400",
    };
  }

  if (stock <= 20) {
    return {
      label: "Watch",
      containerClass: "border-amber-500/60 bg-amber-500/10 text-amber-300",
      dotClass: "bg-amber-400",
    };
  }

  return {
    label: "Healthy",
    containerClass: "border-emerald-500/60 bg-emerald-500/10 text-emerald-300",
    dotClass: "bg-emerald-400",
  };
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

export default function InventoryTable({
  items,
  refreshing,
  lastUpdatedAt,
  onRefresh,
  refreshDisabled = false,
}: InventoryTableProps) {
  const [pageSize, setPageSize] = useState<"10" | "20" | "all">("10");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("stock_asc");
  const controlsDisabled = refreshDisabled;

  const filteredItems = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return items;
    }

    return items.filter((item) => (item.title ?? "").toLowerCase().includes(normalizedQuery));
  }, [items, searchQuery]);

  const sortedItems = useMemo(() => {
    const list = [...filteredItems];

    list.sort((left, right) => {
      if (sortBy === "stock_asc") {
        return compareNullableNumbers(left.available_quantity, right.available_quantity, "asc");
      }
      if (sortBy === "stock_desc") {
        return compareNullableNumbers(left.available_quantity, right.available_quantity, "desc");
      }
      if (sortBy === "price_asc") {
        return compareNullableNumbers(left.price, right.price, "asc");
      }
      return compareNullableNumbers(left.price, right.price, "desc");
    });

    return list;
  }, [filteredItems, sortBy]);

  const effectivePageSize = pageSize === "all" ? sortedItems.length || 1 : Number(pageSize);
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / effectivePageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const visibleItems = useMemo(() => {
    if (pageSize === "all") {
      return sortedItems;
    }

    const start = (safeCurrentPage - 1) * effectivePageSize;
    return sortedItems.slice(start, start + effectivePageSize);
  }, [sortedItems, pageSize, safeCurrentPage, effectivePageSize]);

  function onPageSizeChange(value: "10" | "20" | "all") {
    setPageSize(value);
    setCurrentPage(1);
  }

  function onSearchQueryChange(query: string) {
    setSearchQuery(query);
    setCurrentPage(1);
  }

  function onSortByChange(value: SortOption) {
    setSortBy(value);
    setCurrentPage(1);
  }

  return (
    <section className="border border-[var(--border-1)] bg-[var(--surface-1)]">
      <div className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
              Inventory Table
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-1)]">Stock Listings</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastUpdatedAt ? (
              <p className="text-xs text-[var(--text-3)]">
                Updated {new Date(lastUpdatedAt).toLocaleTimeString()}
              </p>
            ) : null}
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing || refreshDisabled}
              className="inline-flex h-8 cursor-pointer items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-1)] hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:text-[var(--text-3)] disabled:hover:bg-[var(--surface-2)]"
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
        </div>
        <div className="mt-4">
          <InventorySearchBar
            query={searchQuery}
            onQueryChange={onSearchQueryChange}
            disabled={controlsDisabled}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3 border border-[var(--border-1)] bg-[var(--bg-0)] p-3 text-sm">
          <label htmlFor="sort-by" className="text-[var(--text-2)]">
            Sort
          </label>
          <select
            id="sort-by"
            value={sortBy}
            disabled={controlsDisabled}
            onChange={(event) => onSortByChange(event.target.value as SortOption)}
            className="h-9 border border-[var(--border-1)] bg-[var(--surface-1)] px-3 text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="stock_asc">Lowest stock - highest</option>
            <option value="stock_desc">Highest stock - lowest</option>
            <option value="price_asc">Cheapest - most expensive</option>
            <option value="price_desc">Most expensive - cheapest</option>
          </select>
          <label htmlFor="page-size" className="text-[var(--text-2)]">
            Show
          </label>
          <select
            id="page-size"
            value={pageSize}
            disabled={controlsDisabled}
            onChange={(event) => onPageSizeChange(event.target.value as "10" | "20" | "all")}
            className="h-9 border border-[var(--border-1)] bg-[var(--surface-1)] px-3 text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="all">All</option>
          </select>
          <span className="text-[var(--text-3)]">
            {filteredItems.length} result{filteredItems.length === 1 ? "" : "s"}.
          </span>
          <span className="text-[var(--text-3)]">
            Page {safeCurrentPage} of {totalPages}
          </span>
          {pageSize !== "all" && (
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={controlsDisabled || safeCurrentPage === 1}
                className="h-9 border border-[var(--border-1)] bg-[var(--bg-0)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={controlsDisabled || safeCurrentPage === totalPages}
                className="h-9 border border-[var(--border-1)] bg-[var(--bg-0)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto border-t border-[var(--border-1)] bg-[var(--surface-1)]">
        <table className="min-w-full text-left text-sm text-[var(--text-2)]">
          <thead className="bg-[var(--bg-0)] text-[var(--text-1)]">
            <tr>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">ID</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Title</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Stock</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Price</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-[var(--text-3)]" colSpan={5}>
                  No items found.
                </td>
              </tr>
            )}
            {visibleItems.map((item) => (
              <tr key={item.id} className="border-t border-[var(--border-1)] hover:bg-[var(--surface-2)]">
                <td className="px-4 py-3 font-mono text-xs text-[var(--text-2)]">{item.id}</td>
                <td className="px-4 py-3 text-[var(--text-1)]">{item.title ?? "-"}</td>
                <td className="px-4 py-3 text-[var(--text-1)]">
                  {(() => {
                    const stockLevel = getStockLevel(item.available_quantity);
                    return (
                      <span
                        className={`inline-flex items-center gap-2 border px-2 py-1 text-xs font-semibold uppercase tracking-wide ${stockLevel.containerClass}`}
                      >
                        <span className={`h-2 w-2 ${stockLevel.dotClass}`} />
                        {typeof item.available_quantity === "number" ? item.available_quantity : "-"}
                        <span className="text-[10px]">{stockLevel.label}</span>
                      </span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-[var(--text-1)]">{item.price ?? "-"}</td>
                <td className="px-4 py-3 text-[var(--text-2)]">{item.status ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
