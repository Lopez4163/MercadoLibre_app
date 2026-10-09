import type { ReactNode } from "react";

interface V2WorkstationShellProps {
  operations: ReactNode;
  fulfillment: ReactNode;
}

/**
 * Structural home for V2 operations and the later read-only fulfillment queue.
 * Q0 intentionally provides no queue data, controls, or lifecycle actions.
 */
export function V2WorkstationShell({
  operations,
  fulfillment,
}: V2WorkstationShellProps) {
  return (
    <main className="mx-auto grid min-h-screen max-w-6xl gap-6 px-6 py-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)]">
      <section aria-labelledby="operations-heading" className="space-y-5">
        <header>
          <p className="text-sm uppercase tracking-widest text-zinc-500">NotiVenta V2</p>
          <h1 id="operations-heading" className="mt-2 text-3xl font-semibold">
            Operations workstation
          </h1>
        </header>
        {operations}
      </section>
      <aside
        aria-labelledby="fulfillment-heading"
        className="rounded-xl border border-zinc-300 p-5 dark:border-zinc-700"
      >
        <p className="text-sm uppercase tracking-widest text-zinc-500">Read-only</p>
        <h2 id="fulfillment-heading" className="mt-2 text-xl font-semibold">
          Fulfillment Queue
        </h2>
        {fulfillment}
      </aside>
    </main>
  );
}
