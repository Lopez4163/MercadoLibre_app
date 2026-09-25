import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navbar from "../../../../components/layout/Navbar";
import { prisma } from "../../../../lib/db/prisma";
import { getSessionUserIdFromCookieStore } from "../../../../lib/auth/session";

export default async function RegisterPage() {
  const cookieStore = await cookies();
  const sessionUserId = getSessionUserIdFromCookieStore(cookieStore);

  if (sessionUserId) {
    const user = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { id: true },
    });
    if (user) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="min-h-screen">
      <Navbar />
      <section className="mx-auto mt-12 w-full max-w-md border border-[var(--border-1)] bg-[var(--surface-1)] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Crear cuenta</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-1)]">Registrarse</h1>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          Usa OAuth de Mercado Libre para crear tu cuenta y vincular tu perfil vendedor.
        </p>

        <a
          href="/api/ml/oauth/start"
          className="mt-6 inline-flex h-11 w-full items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
        >
          Registrarse con Mercado Libre
        </a>

        <p className="mt-4 text-center text-sm text-[var(--text-2)]">
          Ya tienes acceso?{" "}
          <Link href="/login" className="font-semibold text-[var(--text-1)] underline">
            Iniciar sesion
          </Link>
        </p>
      </section>
    </main>
  );
}
