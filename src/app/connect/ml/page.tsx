import Link from "next/link";
import { cookies } from "next/headers";
import Navbar from "../../../../components/layout/Navbar";
import { prisma } from "../../../../lib/db/prisma";
import { getSessionUserIdFromCookieStore } from "../../../../lib/auth/session";

export default async function ConnectMercadoLibrePage() {
  const cookieStore = await cookies();
  const sessionUserId = getSessionUserIdFromCookieStore(cookieStore);
  const connectedUser = sessionUserId
    ? await prisma.user.findUnique({
        where: { id: sessionUserId },
        select: { id: true, email: true, mlUserId: true },
      })
    : null;

  return (
    <main className="min-h-screen">
      <Navbar />
      <section className="mx-auto max-w-3xl px-6 py-14">
        <div className="border border-[var(--border-1)] bg-[var(--surface-1)] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-3)]">
            Conexion de Mercado Libre
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-1)] md:text-4xl">
            {connectedUser ? "Cuenta conectada" : "Conecta tu cuenta vendedora"}
          </h1>
          <p className="mt-3 text-[var(--text-2)]">
            {connectedUser
              ? "Tu cuenta de Mercado Libre ya esta vinculada. Puedes abrir el panel o reconectar si hace falta."
              : "Inicia sesion y autoriza Mercado Libre para sincronizar items, detectar ventas y enviar alertas por Telegram."}
          </p>

          {connectedUser ? (
            <div className="mt-8 space-y-4">
              <div className="border border-[var(--border-1)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-2)]">
                <p>
                  <span className="font-semibold text-[var(--text-1)]">Correo:</span> {connectedUser.email}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-[var(--text-1)]">ID de usuario ML:</span> {connectedUser.mlUserId}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex h-11 items-center border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
                >
                  Ir al panel
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-5 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
                >
                  Reconectar cuenta
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex h-11 items-center border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
              >
                Continuar al inicio de sesion
              </Link>
              <Link
                href="/register"
                className="inline-flex h-11 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-5 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
              >
                Crear cuenta
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
