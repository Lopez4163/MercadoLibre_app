import type { ReactNode } from "react";

interface V2WorkstationShellProps {
  operations: ReactNode;
  fulfillment: ReactNode;
}

/** A single operational surface: configuration first, then the read-only queue. */
export function V2WorkstationShell({
  operations,
  fulfillment,
}: V2WorkstationShellProps) {
  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 px-6 py-12">
      <header>
        <p className="text-sm uppercase tracking-widest text-zinc-500">NotiVenta V2</p>
        <h1 className="mt-2 text-3xl font-semibold">Operations</h1>
      </header>
      {operations}
      <section
        aria-labelledby="fulfillment-heading"
        className="rounded-xl border border-zinc-300 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-950"
      >
        <p className="text-sm uppercase tracking-widest text-zinc-500">Read-only</p>
        <h2 id="fulfillment-heading" className="mt-2 text-xl font-semibold">
          Fulfillment Queue
        </h2>
        {fulfillment}
      </section>
    </main>
  );
}
