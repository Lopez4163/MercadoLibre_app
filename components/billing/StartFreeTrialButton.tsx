"use client";

import { useState } from "react";

type CheckoutResponse = {
  ok: boolean;
  url?: string;
  error?: string;
  alreadyEntitled?: boolean;
  status?: string | null;
};

type StartFreeTrialButtonProps = {
  initiallyEntitled: boolean;
};

export default function StartFreeTrialButton(props: StartFreeTrialButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
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
        setMessage(`Your subscription is already ${data.status ?? "active"}.`);
        return;
      }

      if (!data.url) {
        throw new Error("missing_checkout_url");
      }

      window.location.assign(data.url);
    } catch (err) {
      const messageText = err instanceof Error ? err.message : "unknown_error";
      setError(messageText);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void handleClick()}
        disabled={loading || props.initiallyEntitled}
        className="inline-flex h-11 items-center border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Redirecting..." : props.initiallyEntitled ? "Trial Active" : "Start Free Trial"}
      </button>
      {message && <p className="text-sm text-emerald-300">{message}</p>}
      {error && <p className="text-sm text-red-300">Checkout error: {error}</p>}
    </div>
  );
}
