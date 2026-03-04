"use client";

type InventorySearchBarProps = {
  query: string;
  onQueryChange: (query: string) => void;
};

export default function InventorySearchBar({ query, onQueryChange }: InventorySearchBarProps) {
  return (
    <div className="w-full md:max-w-sm">
      <label htmlFor="inventory-search" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
        Search by name
      </label>
      <input
        id="inventory-search"
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Type an item name..."
        className="h-9 w-full border border-[var(--border-1)] bg-[var(--bg-0)] px-3 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none"
      />
    </div>
  );
}
