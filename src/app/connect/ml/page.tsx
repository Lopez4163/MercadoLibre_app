import Link from "next/link";
import { cookies } from "next/headers";
import Navbar from "../../../../components/layout/Navbar";
import { prisma } from "../../../../lib/db/prisma";

export default async function ConnectMercadoLibrePage() {
  const cookieStore = await cookies();
  const sessionUserId = cookieStore.get("ml_user_id")?.value;
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
            Mercado Libre Connection
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-1)] md:text-4xl">
            {connectedUser ? "Account connected" : "Connect your seller account"}
          </h1>
          <p className="mt-3 text-[var(--text-2)]">
            {connectedUser
              ? "Your Mercado Libre account is already linked. You can open the dashboard or reconnect if needed."
              : "Sign in and authorize Mercado Libre so we can sync items, detect sales, and send Telegram alerts."}
          </p>

          {connectedUser ? (
            <div className="mt-8 space-y-4">
              <div className="border border-[var(--border-1)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-2)]">
                <p>
                  <span className="font-semibold text-[var(--text-1)]">Email:</span> {connectedUser.email}
                </p>
                <p className="mt-1">
                  <span className="font-semibold text-[var(--text-1)]">ML User ID:</span> {connectedUser.mlUserId}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex h-11 items-center border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
                >
                  Go to Dashboard
                </Link>
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-5 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
                >
                  Reconnect Account
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex h-11 items-center border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
              >
                Continue to Login
              </Link>
              <Link
                href="/register"
                className="inline-flex h-11 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-5 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
              >
                Create Account
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
