"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CheckoutResponse = {
  ok: boolean;
  url?: string;
  error?: string;
  alreadyEntitled?: boolean;
  status?: string | null;
};

type StartFreeTrialButtonProps = {
  initiallyEntitled: boolean;
  autoStart?: boolean;
};

function billingStatusLabel(status: string | null | undefined) {
  if (status === "active") {
    return "activa";
  }
  if (status === "trialing") {
    return "en prueba";
  }
  if (status === "past_due") {
    return "con pago pendiente";
  }
  if (status === "unpaid") {
    return "impaga";
  }
  if (status === "canceled") {
    return "cancelada";
  }
  return "activa";
}

function checkoutErrorLabel(value: string) {
  if (value === "checkout_failed") {
    return "No se pudo iniciar el checkout.";
  }
  if (value === "missing_checkout_url") {
    return "No se recibio la URL de checkout.";
  }
  if (value === "unknown_error") {
    return "Ocurrio un error inesperado.";
  }
  return value;
}

export default function StartFreeTrialButton(props: StartFreeTrialButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const attemptedAutoStartRef = useRef(false);

  const handleClick = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setMessage(null);

      const response = await fetch("/api/billing/checkout", {
        method: "POST",
      });

      const data = (await response.json()) as CheckoutResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "checkout_failed");
      }

      if (data.alreadyEntitled) {
        setMessage(`Tu suscripcion ya esta ${billingStatusLabel(data.status)}.`);
        return;
      }

      if (!data.url) {
        throw new Error("missing_checkout_url");
      }

      window.location.assign(data.url);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "unknown_error";
      setError(checkoutErrorLabel(messageText));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (attemptedAutoStartRef.current) {
      return;
    }

    if (!props.autoStart || props.initiallyEntitled) {
      return;
    }

    attemptedAutoStartRef.current = true;
    void handleClick();
  }, [handleClick, props.autoStart, props.initiallyEntitled]);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          attemptedAutoStartRef.current = true;
          void handleClick();
        }}
        disabled={loading || props.initiallyEntitled}
        className="inline-flex h-11 items-center border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Redirigiendo..." : props.initiallyEntitled ? "Prueba activa" : "Iniciar prueba gratis"}
      </button>
      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-red-300">Error de checkout: {error}</p>}
    </div>
  );
}
