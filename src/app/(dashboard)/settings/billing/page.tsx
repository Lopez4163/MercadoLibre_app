import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import StartFreeTrialButton from "../../../../../components/billing/StartFreeTrialButton";
import ManageSubscriptionActions from "../../../../../components/billing/ManageSubscriptionActions";
import { prisma } from "../../../../../lib/db/prisma";
import { getSessionUserIdFromCookieStore } from "../../../../../lib/auth/session";
import { getUserBillingEntitlement } from "../../../../../lib/billing/entitlements";

function formatDate(value: Date | null) {
  if (!value) {
    return "No aplica";
  }

  return new Intl.DateTimeFormat("es-AR", {
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

function statusLabel(status: string | null) {
  if (status === "active") {
    return "activa";
  }
  if (status === "trialing") {
    return "en prueba";
  }
  if (status === "past_due") {
    return "pago pendiente";
  }
  if (status === "unpaid") {
    return "impaga";
  }
  if (status === "canceled") {
    return "cancelada";
  }
  return "sin estado";
}

type BillingSettingsPageProps = {
  searchParams?: Promise<{ intent?: string | string[] }>;
};

export default async function BillingSettingsPage({ searchParams }: BillingSettingsPageProps) {
  const cookieStore = await cookies();
  const userId = getSessionUserIdFromCookieStore(cookieStore);
  const params = (await searchParams) ?? {};
  const intentParam = Array.isArray(params.intent) ? params.intent[0] : params.intent;
  const autoStartTrial = intentParam === "trial";

  if (!userId) {
    redirect("/login");
  }

  const [subscription, entitlement] = await Promise.all([
    prisma.billingSubscription.findUnique({
      where: { userId },
      select: {
        status: true,
        trialEnd: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    }),
    getUserBillingEntitlement(userId),
  ]);

  const billingStatus = statusLabel(subscription?.status ?? null);
  const showTrialEnds = subscription?.status === "trialing";

  return (
    <div className="space-y-4">
      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Facturacion</h3>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          El acceso por suscripcion se habilita por eventos webhook de Stripe despues de confirmar checkout.
        </p>

        <div className={`mt-5 grid gap-3 md:grid-cols-2 ${showTrialEnds ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
          <article className="border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Acceso</p>
            <p
              className={`mt-3 text-2xl font-semibold tracking-tight ${
                entitlement.hasAccess ? "text-emerald-200" : "text-red-200"
              }`}
            >
              {entitlement.hasAccess ? "Habilitado" : "Bloqueado"}
            </p>
          </article>
          <article className="border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Estado</p>
            <p className={`mt-3 text-2xl font-semibold tracking-tight capitalize ${statusTone(subscription?.status ?? null)}`}>
              {billingStatus}
            </p>
          </article>
          {showTrialEnds && (
            <article className="border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Fin de prueba</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-1)]">
                {formatDate(subscription?.trialEnd ?? null)}
              </p>
            </article>
          )}
          <article className="border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Fin del periodo actual</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-1)]">
              {formatDate(subscription?.currentPeriodEnd ?? null)}
            </p>
          </article>
        </div>

        <dl className="mt-5 grid gap-3 text-sm text-[var(--text-2)] md:grid-cols-2">
          <div>
            <dt className="text-[var(--text-3)]">Cancelar al fin del periodo</dt>
            <dd className="mt-1 font-medium text-[var(--text-1)]">{subscription?.cancelAtPeriodEnd ? "Si" : "No"}</dd>
          </div>
        </dl>

      </section>

      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Acciones de suscripcion</h3>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          Administra cancelacion y checkout de prueba desde un solo lugar. El acceso cambia solo despues de confirmar webhook de Stripe.
        </p>

        <div className="mt-5 space-y-4">
          {!entitlement.hasAccess && (
            <div className="border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Iniciar prueba gratis</p>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                El checkout es alojado por Stripe y se abre en una pagina segura de Stripe.
              </p>
              <div className="mt-4">
                <StartFreeTrialButton initiallyEntitled={entitlement.hasAccess} autoStart={autoStartTrial} />
              </div>
            </div>
          )}

          <div className="border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Cancelar o reanudar</p>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              Cancelar programa que tu plan termine al cierre del periodo de facturacion actual.
            </p>
            <div className="mt-4">
              <ManageSubscriptionActions
                initialStatus={subscription?.status ?? null}
                initialCancelAtPeriodEnd={subscription?.cancelAtPeriodEnd ?? false}
                currentPeriodEndLabel={formatDate(subscription?.currentPeriodEnd ?? null)}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
