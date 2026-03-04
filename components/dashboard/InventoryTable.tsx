type InventoryItem = {
  id: string;
  title?: string;
  available_quantity?: number;
  price?: number;
  status?: string;
};

type InventoryTableProps = {
  items: InventoryItem[];
};

export default function InventoryTable({ items }: InventoryTableProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Inventory</h2>
        <p className="text-sm text-slate-600">
          Live items synced from your Mercado Libre seller account.
        </p>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td className="px-4 py-3 text-slate-500" colSpan={5}>
                  No items found.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-200">
                <td className="px-4 py-3 font-mono text-xs text-slate-700">{item.id}</td>
                <td className="px-4 py-3 text-slate-800">{item.title ?? "-"}</td>
                <td className="px-4 py-3 text-slate-800">{item.available_quantity ?? "-"}</td>
                <td className="px-4 py-3 text-slate-800">{item.price ?? "-"}</td>
                <td className="px-4 py-3 text-slate-800">{item.status ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
