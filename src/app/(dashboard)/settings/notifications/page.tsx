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
        <h2 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Notification Settings</h2>
        <p className="mt-1 text-sm text-[var(--text-2)]">Control when sales and stock alerts are sent.</p>
        <details className="group mt-4 overflow-hidden border border-[var(--border-1)] bg-[var(--bg-0)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-1)]">How notifications work</p>
              <p className="text-xs text-[var(--text-3)]">When each alert type is triggered</p>
            </div>
            <span className="text-xs text-[var(--text-3)] transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <ul className="space-y-2 border-t border-[var(--border-1)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text-2)]">
            <li>Sale alerts are sent whenever a new order matches your notification rules.</li>
            <li>Sold-out alerts fire when an item moves from positive stock to zero.</li>
            <li>Low-stock alerts trigger when available quantity crosses below your configured threshold.</li>
          </ul>
        </details>
      </section>
      <NotificationRulesCard initialHasBillingAccess={entitlement.hasAccess} />
    </div>
  );
}
