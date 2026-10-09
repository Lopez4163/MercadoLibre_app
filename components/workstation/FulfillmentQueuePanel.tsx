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
  READY: {
    title: "Ready",
    detail: "The next shipment is eligible for dispatch.",
  },
  OCCUPIED: {
    title: "Active assignment",
    detail: "Waiting for the current shipment to finish.",
  },
  BLOCKED: {
    title: "Needs attention",
    detail: "Printing is blocked until the current issue is resolved.",
  },
  PAUSED: {
    title: "Paused",
    detail: "Automatic dispatch is paused.",
  },
  NO_ACTIVE_DEVICE: {
    title: "No active device",
    detail: "Connect an Agent before jobs can be dispatched.",
  },
} as const;

function shipmentLabel(job: FulfillmentQueueJob) {
  return `Shipment #${job.shipmentId}`;
}

function itemSummary(job: FulfillmentQueueJob) {
  const message = snapshotMessage(job);
  if (message) return message;
  return job.items.length
    ? job.items.map((item) => item.title).join(" + ")
    : "No packing items";
}

function snapshotMessage(job: FulfillmentQueueJob) {
  if (job.fulfillmentSnapshotState === "PENDING") return "Packing details loading";
  if (job.fulfillmentSnapshotState === "UNAVAILABLE") return "Packing details unavailable";
  return null;
}

function PackingDetails({ job }: { job: FulfillmentQueueJob }) {
  const message = snapshotMessage(job);
  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm font-medium">{job.totalUnits} total units</p>
      {message ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
      ) : (
        <ul className="space-y-3" aria-label={`${shipmentLabel(job)} packing details`}>
          {job.items.map((item) => (
            <li key={item.itemId} className="text-sm">
              <p className="font-medium">{item.quantity} × {item.title}</p>
              {item.sellerSku && <p className="text-zinc-600 dark:text-zinc-400">SKU: {item.sellerSku}</p>}
              {item.variationSummary && <p className="text-zinc-600 dark:text-zinc-400">{item.variationSummary}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function JobCard({ job, label }: { job: FulfillmentQueueJob; label?: string }) {
  return (
    <article className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      {label && <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{label}</p>}
      <div className={label ? "mt-2" : ""}>
        <h3 className="font-semibold">{shipmentLabel(job)}</h3>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">{job.status.replaceAll("_", " ")}</p>
        {job.orderId && <p className="mt-1 text-xs text-zinc-500">Order #{job.orderId}</p>}
      </div>
      <PackingDetails job={job} />
    </article>
  );
}

function ActiveAssignmentCard({ assignment }: { assignment: FulfillmentActiveAssignment }) {
  return (
    <JobCard job={assignment.job} label="Current" />
  );
}

function QueueRows({
  jobs,
  selectedJobId,
  onSelectJob,
}: {
  jobs: FulfillmentQueueJob[];
  selectedJobId: string | null;
  onSelectJob: (jobId: string) => void;
}) {
  return (
    <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
      {jobs.map((job) => {
        const isSelected = selectedJobId === job.jobId;
        const detailsId = `packing-details-${job.jobId}`;

        return (
          <li key={job.jobId} className="p-1">
            <button
              aria-controls={detailsId}
              aria-expanded={isSelected}
              className="w-full rounded-md p-3 text-left transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-800 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100"
              onClick={() => onSelectJob(job.jobId)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{shipmentLabel(job)}</p>
                  <p className="mt-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                    {job.totalUnits} total units · {itemSummary(job)}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                    {job.status.replaceAll("_", " ")}
                  </p>
                </div>
                <span aria-hidden="true" className="pt-1 text-lg text-zinc-500">
                  {isSelected ? "⌃" : "›"}
                </span>
              </div>
            </button>
            {isSelected && (
              <div className="px-3 pb-3" id={detailsId}>
                <PackingDetails job={job} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function FulfillmentQueueContent({ queue }: { queue: FulfillmentQueue }) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const state = dispatchCopy[queue.dispatchState];
  const noJobs = !queue.activeAssignment && !queue.queued.length && !queue.needsAttention.length && !queue.recentCompleted.length;
  const selectJob = (jobId: string) => {
    setSelectedJobId((current) => (current === jobId ? null : jobId));
  };

  return (
    <div className="mt-5 space-y-6">
      <section className="rounded-lg bg-zinc-100 p-4 dark:bg-zinc-800" aria-label="Dispatch state">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Dispatch</p>
        <h3 className="mt-1 font-semibold">{state.title}</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{state.detail}</p>
      </section>

      {queue.activeAssignment && (
        <section>
          <ActiveAssignmentCard assignment={queue.activeAssignment} />
          <p className="mt-2 text-xs text-zinc-500">Attempt {queue.activeAssignment.attemptStatus.replaceAll("_", " ")}</p>
        </section>
      )}

      {queue.queued.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Waiting queue · {queue.queued.length}</h3>
          <div className="mt-3"><QueueRows jobs={queue.queued} selectedJobId={selectedJobId} onSelectJob={selectJob} /></div>
        </section>
      )}

      {queue.needsAttention.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">Needs attention · {queue.needsAttention.length}</h3>
          <div className="mt-3"><QueueRows jobs={queue.needsAttention} selectedJobId={selectedJobId} onSelectJob={selectJob} /></div>
        </section>
      )}

      {queue.recentCompleted.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Recently completed</h3>
          <div className="mt-3"><QueueRows jobs={queue.recentCompleted} selectedJobId={selectedJobId} onSelectJob={selectJob} /></div>
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
    const intervalId = window.setInterval(
      refreshWhenVisible,
      FULFILLMENT_QUEUE_REFRESH_INTERVAL_MS,
    );

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
