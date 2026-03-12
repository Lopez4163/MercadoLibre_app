import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../../../../lib/db/prisma";
import { getSessionUserIdFromCookieStore } from "../../../../../lib/auth/session";
import { getUserBillingEntitlement } from "../../../../../lib/billing/entitlements";
import StartFreeTrialButton from "../../../../../components/billing/StartFreeTrialButton";

function formatDate(value: Date | null) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function statusTone(status: string | null) {
  if (status === "active" || status === "trialing") {
    return "text-emerald-300";
  }

  if (status === "past_due" || status === "unpaid") {
    return "text-amber-300";
  }

  if (status === "canceled") {
    return "text-red-300";
  }

  return "text-[var(--text-3)]";
}

export default async function BillingPage() {
  const cookieStore = await cookies();
  const userId = getSessionUserIdFromCookieStore(cookieStore);

  if (!userId) {
    redirect("/login");
  }

  const [subscription, entitlement] = await Promise.all([
    prisma.billingSubscription.findUnique({
      where: { userId },
      select: {
        status: true,
        priceId: true,
        trialEnd: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    }),
    getUserBillingEntitlement(userId),
  ]);

  const status = subscription?.status ?? "none";

  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Billing</p>
        <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-1)] md:text-4xl">Subscription</h2>
        <p className="text-sm text-[var(--text-2)]">Your access is webhook-driven from Stripe events.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Entitlement</p>
          <p className={`mt-3 text-2xl font-semibold tracking-tight ${entitlement.hasAccess ? "text-emerald-200" : "text-red-200"}`}>
            {entitlement.hasAccess ? "Enabled" : "Locked"}
          </p>
        </article>

        <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Status</p>
          <p className={`mt-3 text-2xl font-semibold tracking-tight capitalize ${statusTone(subscription?.status ?? null)}`}>
            {status}
          </p>
        </article>

        <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Trial Ends</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-1)]">
            {formatDate(subscription?.trialEnd ?? null)}
          </p>
        </article>

        <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Current Period Ends</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-1)]">
            {formatDate(subscription?.currentPeriodEnd ?? null)}
          </p>
        </article>
      </section>

      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Details</h3>
        <dl className="mt-4 grid gap-3 text-sm text-[var(--text-2)] md:grid-cols-2">
          <div>
            <dt className="text-[var(--text-3)]">Price ID</dt>
            <dd className="mt-1 font-medium text-[var(--text-1)]">{subscription?.priceId ?? "N/A"}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-3)]">Cancel At Period End</dt>
            <dd className="mt-1 font-medium text-[var(--text-1)]">{subscription?.cancelAtPeriodEnd ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </section>

      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Start Free Trial</h3>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          Checkout is hosted by Stripe. Access is granted once webhook events confirm your subscription state.
        </p>
        <div className="mt-4">
          <StartFreeTrialButton initiallyEntitled={entitlement.hasAccess} />
        </div>
      </section>
    </main>
  );
}
