"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getFulfillmentQueue,
  type FulfillmentActiveAssignment,
  type FulfillmentQueue,
  type FulfillmentQueueJob,
} from "../../lib/v2/api";
import {
  canRefreshFulfillmentQueue,
  FULFILLMENT_QUEUE_REFRESH_INTERVAL_MS,
} from "../../lib/v2/fulfillment-queue-refresh";

const dispatchCopy = {
  READY: { title: "Ready", detail: "The next shipment is eligible for dispatch." },
  OCCUPIED: { title: "Active assignment", detail: "Waiting for the current shipment to finish." },
  BLOCKED: { title: "Needs attention", detail: "Printing is blocked until the current issue is resolved." },
  PAUSED: { title: "Paused", detail: "Automatic dispatch is paused." },
  NO_ACTIVE_DEVICE: { title: "No active device", detail: "Connect an Agent before jobs can be dispatched." },
} as const;

function shipmentLabel(job: FulfillmentQueueJob) {
  return `Shipment #${job.shipmentId}`;
}

function operationalStatusLabel(job: FulfillmentQueueJob) {
  if (job.status === "FAILED") return "Print failed";
  if (job.status === "NEEDS_ATTENTION") return "Print outcome unknown";
  return job.status.replaceAll("_", " ");
}

function snapshotMessage(job: FulfillmentQueueJob) {
  if (job.fulfillmentSnapshotState === "PENDING") return "Packing details pending";
  if (job.fulfillmentSnapshotState === "UNAVAILABLE") return "Packing details unavailable";
  return null;
}

function itemSummary(job: FulfillmentQueueJob) {
  const message = snapshotMessage(job);
  if (message) return message;
  if (!job.items.length) return "No packing items";
  return job.items.map((item) => {
    const sku = item.sellerSku ? ` · SKU: ${item.sellerSku}` : "";
    const variation = item.variationSummary ? ` · ${item.variationSummary}` : "";
    return `${item.quantity} × ${item.title}${sku}${variation}`;
  }).join("; ");
}

function QueueTable({
  jobs,
  attemptStatuses = new Map<string, string>(),
}: {
  jobs: FulfillmentQueueJob[];
  attemptStatuses?: ReadonlyMap<string, string>;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
      <table className="min-w-full divide-y divide-zinc-200 text-left text-sm dark:divide-zinc-700">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th className="px-4 py-3 font-semibold" scope="col">Shipment</th>
            <th className="px-4 py-3 font-semibold" scope="col">Status</th>
            <th className="px-4 py-3 font-semibold" scope="col">Packing details</th>
            <th className="px-4 py-3 text-right font-semibold" scope="col">Units</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {jobs.map((job) => {
            const attemptStatus = attemptStatuses.get(job.jobId);
            return (
              <tr key={job.jobId}>
                <td className="whitespace-nowrap px-4 py-3 font-medium">
                  <p>{shipmentLabel(job)}</p>
                  {job.orderId && <p className="mt-1 text-xs font-normal text-zinc-500">Order #{job.orderId}</p>}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">{operationalStatusLabel(job)}</p>
                  {attemptStatus && <p className="mt-1 text-xs text-zinc-500">Attempt {attemptStatus.replaceAll("_", " ")}</p>}
                </td>
                <td className="min-w-72 px-4 py-3 text-zinc-700 dark:text-zinc-300">{itemSummary(job)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium">{job.totalUnits}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ActiveAssignmentTable({ assignment }: { assignment: FulfillmentActiveAssignment }) {
  return (
    <section>
      <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Current assignment</h3>
      <QueueTable
        jobs={[assignment.job]}
        attemptStatuses={new Map([[assignment.job.jobId, assignment.attemptStatus]])}
      />
    </section>
  );
}

export function FulfillmentQueueContent({ queue }: { queue: FulfillmentQueue }) {
  const state = dispatchCopy[queue.dispatchState];
  const noJobs = !queue.activeAssignment && !queue.queued.length && !queue.needsAttention.length && !queue.recentCompleted.length;

  return (
    <div className="mt-5 space-y-6">
      <section className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800" aria-label="Dispatch state">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Dispatch</p>
        <h3 className="mt-1 font-semibold">{state.title}</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{state.detail}</p>
      </section>

      {queue.activeAssignment && <ActiveAssignmentTable assignment={queue.activeAssignment} />}

      {queue.queued.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Waiting queue · {queue.queued.length}</h3>
          <QueueTable jobs={queue.queued} />
        </section>
      )}

      {queue.needsAttention.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">Printing attention · {queue.needsAttention.length}</h3>
          <QueueTable jobs={queue.needsAttention} />
        </section>
      )}

      {queue.recentCompleted.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Recently completed</h3>
          <QueueTable jobs={queue.recentCompleted} />
        </section>
      )}

      {noJobs && (
        <section className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm dark:border-zinc-700">
          <h3 className="font-semibold">Queue is clear</h3>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">New eligible Mercado Libre shipments will appear here.</p>
        </section>
      )}
    </div>
  );
}

export function FulfillmentQueuePanel() {
  const { getToken } = useAuth();
  const [queue, setQueue] = useState<FulfillmentQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const refreshInFlight = useRef(false);
  const hasLoadedQueue = useRef(false);

  const loadQueue = useCallback(async (mode: "initial" | "background" = "initial") => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (mode === "initial") {
      setLoading(true);
      setError(false);
    }
    try {
      const token = await getToken();
      if (!token) throw new Error("No active Clerk session is available");
      setQueue(await getFulfillmentQueue(token));
      hasLoadedQueue.current = true;
      setError(false);
    } catch {
      if (!hasLoadedQueue.current) setError(true);
    } finally {
      refreshInFlight.current = false;
      if (mode === "initial") setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (canRefreshFulfillmentQueue(document.visibilityState)) {
        void loadQueue("background");
      }
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const intervalId = window.setInterval(refreshWhenVisible, FULFILLMENT_QUEUE_REFRESH_INTERVAL_MS);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(intervalId);
    };
  }, [loadQueue]);

  if (loading) return <p className="mt-5 text-sm text-zinc-600 dark:text-zinc-400">Loading fulfillment queue…</p>;
  if (error || !queue) {
    return (
      <div className="mt-5" role="alert">
        <p className="text-sm">Unable to load fulfillment queue</p>
        <button className="mt-3 rounded-lg border border-zinc-500 px-3 py-2 text-sm font-semibold" onClick={() => void loadQueue()} type="button">Retry</button>
      </div>
    );
  }
  return <FulfillmentQueueContent queue={queue} />;
}
