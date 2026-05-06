import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import NotificationRulesCard from "../../../../../components/dashboard/NotificationRulesCard";
import { getSessionUserIdFromCookieStore } from "../../../../../lib/auth/session";
import { getUserBillingEntitlement } from "../../../../../lib/billing/entitlements";

export default async function SettingsNotificationsPage() {
  const cookieStore = await cookies();
  const userId = getSessionUserIdFromCookieStore(cookieStore);

  if (!userId) {
    redirect("/login");
  }

  const entitlement = await getUserBillingEntitlement(userId);

  return (
    <div className="space-y-4">
      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <h2 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Configuracion de notificaciones</h2>
        <p className="mt-1 text-sm text-[var(--text-2)]">Controla cuando se envian alertas de ventas y stock.</p>
        <details className="group mt-4 overflow-hidden border border-[var(--border-1)] bg-[var(--bg-0)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-1)]">Como funcionan las notificaciones</p>
              <p className="text-xs text-[var(--text-3)]">Cuando se dispara cada tipo de alerta</p>
            </div>
            <span className="text-xs text-[var(--text-3)] transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <ul className="space-y-2 border-t border-[var(--border-1)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-2)]">
            <li>Las alertas de venta se envian cuando un nuevo pedido coincide con tus reglas.</li>
            <li>Las alertas de agotado se disparan cuando un articulo pasa de stock positivo a cero.</li>
            <li>Las alertas de bajo stock se disparan cuando la cantidad disponible baja de tu umbral.</li>
          </ul>
        </details>
      </section>
      <NotificationRulesCard initialHasBillingAccess={entitlement.hasAccess} />
    </div>
  );
}
