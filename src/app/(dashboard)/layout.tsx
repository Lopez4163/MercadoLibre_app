import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../../lib/db/prisma";
import { getSessionUserIdFromCookieStore } from "../../../lib/auth/session";
import DashboardHeaderNav from "../../../components/layout/DashboardHeaderNav";
import { isDemoMode } from "../../../lib/demo-mode";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const demoMode = isDemoMode();
  const cookieStore = await cookies();
  const sessionUserId = getSessionUserIdFromCookieStore(cookieStore);

  if (!demoMode && !sessionUserId) {
    redirect("/login");
  }

  const user = demoMode
    ? { id: "demo-user", mlUserId: "DEMO_SELLER", accessToken: "demo", refreshToken: "demo" }
    : await prisma.user.findUnique({
        where: { id: sessionUserId! },
        select: { id: true, mlUserId: true, accessToken: true, refreshToken: true },
      });

  if (!user) {
    redirect("/login");
  }

  if (!user.mlUserId || !user.accessToken || !user.refreshToken) {
    redirect("/connect/ml");
  }

  return (
    <section className="min-h-screen">
      <header className="border-b border-[var(--border-1)] bg-[var(--surface-1)]">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--text-3)]">
                MercadoLibs
              </p>
              {demoMode ? (
                <span className="border border-[var(--border-1)] bg-[var(--surface-2)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-2)]">
                  Demo mode
                </span>
              ) : null}
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Operaciones del vendedor</h1>
          </div>
          <DashboardHeaderNav />
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl px-6 py-6">{children}</div>
    </section>
  );
}
