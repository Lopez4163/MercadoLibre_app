import Link from "next/link";

import { V2WorkstationShell } from "../../../../components/workstation/V2WorkstationShell";

export default function V2WorkstationPage() {
  return (
    <V2WorkstationShell
      operations={
        <section className="rounded-xl border border-zinc-300 p-5 dark:border-zinc-700">
          <h2 className="text-xl font-semibold">Connection and device operations</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Mercado Libre connection, pairing, and Device status remain on the V2 connection page.
          </p>
          <Link
            className="mt-5 inline-flex rounded-lg bg-black px-4 py-2 font-semibold text-white dark:bg-white dark:text-black"
            href="/v2/connect"
          >
            Open connection settings
          </Link>
        </section>
      }
      fulfillment={
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Packing details will be added after the backend enrichment and read-only queue API phases.
        </p>
      }
    />
  );
}
