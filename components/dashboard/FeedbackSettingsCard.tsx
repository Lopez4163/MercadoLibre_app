"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type FeedbackCategory = "bug" | "feature_request" | "confusing_ux" | "billing_issue" | "general";

type FeedbackEntry = {
  id: string;
  category: FeedbackCategory;
  message: string;
  pagePath: string | null;
  createdAt: string;
};

const feedbackCategoryOptions: Array<{ value: FeedbackCategory; label: string }> = [
  { value: "bug", label: "Bug" },
  { value: "feature_request", label: "Feature request" },
  { value: "confusing_ux", label: "Confusing UX" },
  { value: "billing_issue", label: "Billing issue" },
  { value: "general", label: "General" },
];

function formatFeedbackDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatCategoryLabel(value: FeedbackCategory) {
  const match = feedbackCategoryOptions.find((option) => option.value === value);
  return match?.label ?? value;
}

export default function FeedbackSettingsCard() {
  const searchParams = useSearchParams();
  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [message, setMessage] = useState("");
  const [pagePath, setPagePath] = useState("");
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const from = searchParams.get("from")?.trim();
    if (from) {
      setPagePath(from.slice(0, 240));
    }
  }, [searchParams]);

  useEffect(() => {
    void loadEntries();
  }, []);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccess(null);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [success]);

  async function loadEntries() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/feedback", { cache: "no-store" });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        entries?: FeedbackEntry[];
      };

      if (!response.ok || !data.ok || !data.entries) {
        throw new Error(data.error ?? "failed_to_load_feedback");
      }

      setEntries(data.entries);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "failed_to_load_feedback");
    } finally {
      setLoading(false);
    }
  }

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
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        entry?: FeedbackEntry;
      };

      if (!response.ok || !data.ok || !data.entry) {
        throw new Error(data.error ?? "failed_to_submit_feedback");
      }

      const entry = data.entry;
      setEntries((current) => {
        const nextEntries: FeedbackEntry[] = [entry, ...current];
        return nextEntries.slice(0, 10);
      });
      setMessage("");
      setSuccess("Feedback submitted.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "failed_to_submit_feedback");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Feedback</p>
        <h3 className="mt-2 text-lg font-semibold tracking-tight text-[var(--text-1)]">Tell us what happened</h3>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          Capture bugs, confusing flows, feature requests, and billing friction while you are using the app.
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

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-[var(--text-3)]">Minimum 10 characters. Recent submissions stay visible below.</p>
            <button
              type="submit"
              disabled={submitting || message.trim().length < 10}
              className="inline-flex h-11 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text-1)] transition-all duration-150 hover:bg-[var(--surface-1)] disabled:cursor-not-allowed disabled:text-[var(--text-3)]"
            >
              {submitting ? "Submitting..." : "Submit feedback"}
            </button>
          </div>

          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
        </form>
      </section>

      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Recent feedback</h3>
        <p className="mt-2 text-sm text-[var(--text-2)]">Latest 10 submissions from your account.</p>

        <div className="mt-4 space-y-3">
          {loading ? <p className="text-sm text-[var(--text-3)]">Loading feedback...</p> : null}
          {!loading && entries.length === 0 ? (
            <p className="border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3 text-sm text-[var(--text-3)]">
              No feedback submitted yet.
            </p>
          ) : null}
          {!loading
            ? entries.map((entry) => (
                <article key={entry.id} className="border border-[var(--border-1)] bg-[var(--bg-0)] px-3 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">
                      {formatCategoryLabel(entry.category)}
                    </p>
                    <p className="text-xs text-[var(--text-3)]">{formatFeedbackDate(entry.createdAt)}</p>
                  </div>
                  {entry.pagePath ? (
                    <p className="mt-2 text-xs font-medium text-[var(--text-3)]">Page: {entry.pagePath}</p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--text-1)]">{entry.message}</p>
                </article>
              ))
            : null}
        </div>
      </section>
    </div>
  );
}
