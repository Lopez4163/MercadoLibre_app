import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import TelegramSettingsCard from "../../../../../components/dashboard/TelegramSettingsCard";
import { getSessionUserIdFromCookieStore } from "../../../../../lib/auth/session";
import { getUserBillingEntitlement } from "../../../../../lib/billing/entitlements";

export default async function SettingsTelegramPage() {
  const cookieStore = await cookies();
  const userId = getSessionUserIdFromCookieStore(cookieStore);

  if (!userId) {
    redirect("/login");
  }

  const entitlement = await getUserBillingEntitlement(userId);

  return (
    <div className="space-y-4">
      <TelegramSettingsCard initialHasBillingAccess={entitlement.hasAccess} />
      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Telegram delivery notes</h3>
        <ul className="mt-4 space-y-3 text-sm text-[var(--text-2)]">
          <li>Use the connect action to bind your seller account to a Telegram chat.</li>
          <li>Send a test ping after setup to verify the bot can deliver messages into the correct chat.</li>
          <li>Disconnecting Telegram stops future delivery until the chat is connected again.</li>
        </ul>
      </section>
    </div>
  );
}
