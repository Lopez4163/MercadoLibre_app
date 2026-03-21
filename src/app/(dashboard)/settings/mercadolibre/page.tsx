import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../../../../lib/db/prisma";
import { getSessionUserIdFromCookieStore } from "../../../../../lib/auth/session";
import MercadoLibreSettingsCard from "../../../../../components/dashboard/MercadoLibreSettingsCard";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatOptionalDate(value: Date | null | undefined) {
  if (!value) {
    return "No aplica";
  }

  return formatDate(value);
}

export default async function SettingsMercadoLibrePage() {
  const cookieStore = await cookies();
  const sessionUserId = getSessionUserIdFromCookieStore(cookieStore);

  if (!sessionUserId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: {
      mlUserId: true,
      mlNickname: true,
      accessToken: true,
      refreshToken: true,
      createdAt: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const mlConnected = Boolean(user.accessToken) && Boolean(user.refreshToken);

  return (
    <div className="space-y-4">
      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Estado de conexion</h3>
        <dl className="mt-4 grid gap-3 text-sm text-[var(--text-2)] md:grid-cols-2">
          <div>
            <dt className="text-[var(--text-3)]">Estado</dt>
            <dd className="mt-1 font-medium text-[var(--text-1)]">{mlConnected ? "Conectado" : "Desconectado"}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-3)]">ML User ID</dt>
            <dd className="mt-1 font-medium text-[var(--text-1)]">{user.mlUserId}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-3)]">Nombre de tienda</dt>
            <dd className="mt-1 font-medium text-[var(--text-1)]">{user.mlNickname ?? "No aplica"}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-3)]">Conectado desde</dt>
            <dd className="mt-1 font-medium text-[var(--text-1)]">
              {mlConnected ? formatOptionalDate(user.createdAt) : "No aplica"}
            </dd>
          </div>
        </dl>
      </section>
      <MercadoLibreSettingsCard />
      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Notas de conexion</h3>
        <ul className="mt-4 space-y-3 text-sm text-[var(--text-2)]">
          <li>Desconecta solo cuando quieras detener la sincronizacion de Mercado Libre para esta cuenta.</li>
          <li>Desconectar limpia la sesion de la app y requiere un nuevo OAuth para continuar.</li>
          <li>Telegram puede quedar conectado, pero las alertas requieren una conexion activa de Mercado Libre.</li>
        </ul>
      </section>
    </div>
  );
}
