"use client";

import { useMemo, useState } from "react";

type ManageSubscriptionActionsProps = {
  initialStatus: string | null;
  initialCancelAtPeriodEnd: boolean;
  currentPeriodEndLabel: string;
};

type ActionResponse = {
  ok: boolean;
  error?: string;
  status?: string | null;
  cancelAtPeriodEnd?: boolean;
};

function canManageSubscription(status: string | null) {
  return status === "active" || status === "trialing" || status === "past_due" || status === "unpaid";
}

export default function ManageSubscriptionActions(props: ManageSubscriptionActionsProps) {
  const [status, setStatus] = useState<string | null>(props.initialStatus);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(props.initialCancelAtPeriodEnd);
  const [loading, setLoading] = useState<"cancel" | "resume" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const manageable = useMemo(() => canManageSubscription(status), [status]);
  const showCancel = manageable && !cancelAtPeriodEnd;
  const showResume = manageable && cancelAtPeriodEnd;

  async function runAction(path: "/api/billing/cancel" | "/api/billing/resume", mode: "cancel" | "resume") {
    try {
      setLoading(mode);
      setError(null);
      setMessage(null);

      const response = await fetch(path, { method: "POST" });
      const data = (await response.json()) as ActionResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "billing_action_failed");
      }

      if (typeof data.cancelAtPeriodEnd === "boolean") {
        setCancelAtPeriodEnd(data.cancelAtPeriodEnd);
      }

      if (typeof data.status === "string") {
        setStatus(data.status);
      }

      setMessage(mode === "cancel" ? "Cancelacion programada." : "Cancelacion removida. La suscripcion se renovara.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "unknown_error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {showCancel && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={loading !== null}
            className="inline-flex h-11 items-center border border-red-500/50 bg-red-600/20 px-5 text-sm font-semibold text-red-200 hover:border-red-400 hover:bg-red-600/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === "cancel" ? "Cancelando..." : "Cancelar suscripcion"}
          </button>
        )}

        {showResume && (
          <button
            type="button"
            onClick={() => {
              void runAction("/api/billing/resume", "resume");
            }}
            disabled={loading !== null}
            className="inline-flex h-11 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-5 text-sm font-semibold text-[var(--text-1)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading === "resume" ? "Actualizando..." : "Reanudar suscripcion"}
          </button>
        )}
      </div>

      {cancelAtPeriodEnd && (
        <p className="text-sm text-amber-300">La cancelacion esta programada. El acceso sigue hasta {props.currentPeriodEndLabel}.</p>
      )}

      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-red-300">Fallo al actualizar facturacion: {error}</p>}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
            <h4 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Cancelar suscripcion?</h4>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              Mantendras acceso hasta {props.currentPeriodEndLabel}. Puedes reanudar antes de que termine.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={loading !== null}
                className="inline-flex h-10 items-center border border-[var(--border-1)] bg-transparent px-4 text-sm font-semibold text-[var(--text-1)] hover:border-[var(--text-2)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Mantener suscripcion
              </button>
              <button
                type="button"
                onClick={async () => {
                  setConfirmOpen(false);
                  await runAction("/api/billing/cancel", "cancel");
                }}
                disabled={loading !== null}
                className="inline-flex h-10 items-center border border-red-500/50 bg-red-600/20 px-4 text-sm font-semibold text-red-200 hover:border-red-400 hover:bg-red-600/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Si, cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
