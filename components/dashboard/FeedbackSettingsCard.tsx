"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type FeedbackCategory = "bug" | "feature_request" | "confusing_ux" | "billing_issue" | "general";

const feedbackCategoryOptions: Array<{ value: FeedbackCategory; label: string }> = [
  { value: "bug", label: "Bug" },
  { value: "feature_request", label: "Feature request" },
  { value: "confusing_ux", label: "Confusing UX" },
  { value: "billing_issue", label: "Billing issue" },
  { value: "general", label: "General" },
];

const FEEDBACK_SUCCESS_COOLDOWN_MS = 15_000;

export default function FeedbackSettingsCard() {
  const searchParams = useSearchParams();
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [pagePath, setPagePath] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0);

  useEffect(() => {
    const from = searchParams.get("from")?.trim();
    if (from) {
      setPagePath(from.slice(0, 240));
    }
  }, [searchParams]);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccess(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownRemainingSeconds(0);
      return;
    }

    const updateCooldown = () => {
      const remainingMs = cooldownUntil - Date.now();
      if (remainingMs <= 0) {
        setCooldownUntil(null);
        setCooldownRemainingSeconds(0);
        return;
      }

      setCooldownRemainingSeconds(Math.ceil(remainingMs / 1000));
    };

    updateCooldown();
    const timer = window.setInterval(updateCooldown, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category,
          message,
          pagePath,
          website,
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? "failed_to_submit_feedback");
      }

      setMessage("");
      setSuccess("Feedback submitted.");
      setCooldownUntil(Date.now() + FEEDBACK_SUCCESS_COOLDOWN_MS);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "failed_to_submit_feedback");
    } finally {
      setSubmitting(false);
    }
  }

  const isCooldownActive = cooldownUntil !== null && cooldownRemainingSeconds > 0;
  const isSubmitDisabled = submitting || isCooldownActive || message.trim().length < 10;

  return (
    <div className="space-y-4">
      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Feedback</p>
        <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">Tell us what happened</h3>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          Tell us if something is wrong or if there is a feature you would like to see added. We use feedback to
          identify pain points we can fix.
        </p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="text-[var(--text-2)]">Category</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as FeedbackCategory)}
                disabled={submitting}
                className="h-11 w-full border border-[var(--border-1)] bg-[var(--bg-0)] px-3 text-[var(--text-1)] outline-none focus:border-[var(--text-2)]"
              >
                {feedbackCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm">
              <span className="text-[var(--text-2)]">Related page</span>
              <input
                value={pagePath}
                onChange={(event) => setPagePath(event.target.value)}
                disabled={submitting}
                maxLength={240}
                placeholder="/dashboard or /settings/telegram"
                className="h-11 w-full border border-[var(--border-1)] bg-[var(--bg-0)] px-3 text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--text-2)]"
              />
            </label>
          </div>

          <label className="block space-y-2 text-sm">
            <span className="text-[var(--text-2)]">What happened?</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={submitting}
              minLength={10}
              maxLength={4000}
              rows={6}
              placeholder="Describe what you tried, what you expected, and what the app did instead."
              className="w-full border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3 text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)] focus:border-[var(--text-2)]"
            />
          </label>

          <label className="hidden" aria-hidden="true">
            <span>Website</span>
            <input
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              disabled={submitting}
              name="website"
            />
          </label>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-3)]">Minimum 10 characters.</p>
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="inline-flex h-11 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text-1)] transition-all duration-150 hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:text-[var(--text-3)]"
            >
              {submitting
                ? "Submitting..."
                : isCooldownActive
                  ? `Wait ${cooldownRemainingSeconds}s`
                  : "Submit feedback"}
            </button>
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
        </form>
      </section>
    </div>
  );
}
