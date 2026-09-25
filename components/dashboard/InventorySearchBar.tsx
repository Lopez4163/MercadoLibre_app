"use client";

type InventorySearchBarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  disabled?: boolean;
};

export default function InventorySearchBar({ query, onQueryChange, disabled = false }: InventorySearchBarProps) {
  return (
    <div className="w-full md:max-w-sm">
      <label htmlFor="inventory-search" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
        Buscar por nombre
      </label>
      <input
        id="inventory-search"
        type="search"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        disabled={disabled}
        placeholder="Escribe el nombre de un articulo..."
        className="h-9 w-full border border-[var(--border-1)] bg-[var(--bg-0)] px-3 text-sm text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
}
