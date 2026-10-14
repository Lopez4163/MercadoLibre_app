"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  getFulfillmentQueue,
  reportPrintJobIssue,
  resolveUnknownPrintJob,
  type PrintJobResolutionDecision,
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

type PendingAction =
  | { kind: "PRINTED" | "RETRY"; job: FulfillmentQueueJob }
  | { kind: "ISSUE"; job: FulfillmentQueueJob };

function attentionCopy(job: FulfillmentQueueJob) {
  if (job.attention?.outcome === "PRINT_FAILED") {
    return "This print failed. Do not retry it here; report the issue for support follow-up.";
  }
  return "Inspect the printer and label before choosing what happened. This screen never prints directly.";
}

export function PrintingAttentionActions({
  job,
  onAction,
}: {
  job: FulfillmentQueueJob;
  onAction: (action: PendingAction) => void;
}) {
  const attention = job.attention;
  if (!attention) return null;
  const unknown = attention.outcome === "UNKNOWN";
  return (
    <article className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30" aria-label={`Printing issue for ${shipmentLabel(job)}`}>
      <h4 className="font-semibold">Printing issue · {shipmentLabel(job)}</h4>
      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{attentionCopy(job)}</p>
      {unknown && !attention.retryAllowed && <p className="mt-2 text-sm font-medium">The permitted retry has already been used. You can still confirm that this label printed.</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {unknown && <button className="rounded-lg border border-zinc-500 px-3 py-2 text-sm font-semibold" type="button" onClick={() => onAction({ kind: "PRINTED", job })}>Yes, it printed</button>}
        {unknown && attention.retryAllowed && <button className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white" type="button" onClick={() => onAction({ kind: "RETRY", job })}>No, it didn&apos;t print</button>}
        {attention.issueReportingAllowed && <button className="rounded-lg border border-zinc-500 px-3 py-2 text-sm font-semibold" type="button" onClick={() => onAction({ kind: "ISSUE", job })}>Report an issue</button>}
      </div>
    </article>
  );
}

export function FulfillmentQueuePanel() {
  const { getToken } = useAuth();
  const [queue, setQueue] = useState<FulfillmentQueue | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [issueDescription, setIssueDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const idempotencyKeys = useRef(new Map<string, string>());
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
  const attentionJobs = queue.needsAttention.filter((job) => job.attention);
  const actionKey = pendingAction ? `${pendingAction.kind}:${pendingAction.job.jobId}:${pendingAction.job.attention?.attemptId}` : "";
  const submitAction = async () => {
    if (!pendingAction?.job.attention || submitting) return;
    const description = issueDescription.trim();
    if (pendingAction.kind === "ISSUE" && (description.length < 10 || description.length > 2000)) {
      setActionError("Describe the issue using 10–2,000 characters.");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    const key = idempotencyKeys.current.get(actionKey) ?? crypto.randomUUID();
    idempotencyKeys.current.set(actionKey, key);
    try {
      const token = await getToken();
      if (!token) throw new Error("No active Clerk session is available");
      if (pendingAction.kind === "ISSUE") {
        await reportPrintJobIssue(token, pendingAction.job.jobId, pendingAction.job.attention.attemptId, description, key);
      } else {
        await resolveUnknownPrintJob(token, pendingAction.job.jobId, pendingAction.job.attention.attemptId, pendingAction.kind as PrintJobResolutionDecision, key);
      }
      setPendingAction(null);
      setIssueDescription("");
    } catch {
      setActionError("The request could not be completed. The queue will refresh before you try again.");
    } finally {
      setSubmitting(false);
      await loadQueue("background");
    }
  };
  return <>
    <FulfillmentQueueContent queue={queue} />
    {attentionJobs.length > 0 && <section className="mt-6 space-y-3" aria-label="Printing issue actions">{attentionJobs.map((job) => <PrintingAttentionActions key={job.jobId} job={job} onAction={(action) => { setActionError(null); setIssueDescription(""); setPendingAction(action); }} />)}</section>}
    {pendingAction && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="print-action-title">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-zinc-900">
        <h3 id="print-action-title" className="text-lg font-semibold">{pendingAction.kind === "PRINTED" ? "Confirm printed label" : pendingAction.kind === "RETRY" ? "Authorize one guarded retry" : "Report printing issue"}</h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Shipment #{pendingAction.job.shipmentId}. {pendingAction.kind === "PRINTED" ? "Confirm only if you physically verified the correct label printed. This will not print again." : pendingAction.kind === "RETRY" ? "Confirm only if no label printed. The Backend will apply normal safety checks before any future dispatch." : "This report does not resolve the job, unblock printing, or authorize a retry."}</p>
        {pendingAction.kind === "ISSUE" && <textarea className="mt-4 w-full rounded-lg border border-zinc-400 p-3 text-sm" value={issueDescription} onChange={(event) => setIssueDescription(event.target.value)} minLength={10} maxLength={2000} placeholder="Describe what you observed (10–2,000 characters)" />}
        {actionError && <p className="mt-3 text-sm text-red-700" role="alert">{actionError}</p>}
        <div className="mt-5 flex justify-end gap-2"><button className="rounded-lg border border-zinc-500 px-3 py-2 text-sm font-semibold" type="button" disabled={submitting} onClick={() => setPendingAction(null)}>Cancel</button><button className="rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black" type="button" disabled={submitting} onClick={() => void submitAction()}>{submitting ? "Submitting…" : "Confirm"}</button></div>
      </div>
    </div>}
  </>;
}
