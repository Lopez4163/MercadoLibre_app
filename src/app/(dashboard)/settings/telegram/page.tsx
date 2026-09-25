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
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Notas de entrega por Telegram</h3>
        <ul className="mt-4 space-y-3 text-sm text-[var(--text-2)]">
          <li>Usa la accion de conectar para vincular tu cuenta vendedora con un chat de Telegram.</li>
          <li>Envia una prueba despues de configurar para verificar que el bot entrega en el chat correcto.</li>
          <li>Desconectar Telegram detiene entregas futuras hasta volver a conectar el chat.</li>
        </ul>
      </section>
    </div>
  );
}
