import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Image from "next/image";
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
    <section className="min-h-screen bg-[var(--bg-0)]" data-theme="dark">
      <header className="sticky top-0 z-40 border-b border-[var(--border-1)] bg-[#151408]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Image
                  src="/images/logo/notiventa-logo-transparent.png"
                  alt="NotiVenta"
                  width={1234}
                  height={247}
                  className="h-9 w-[180px] object-contain object-left"
                  priority
                />
              </div>
              {demoMode ? (
                <span className="rounded border border-[#4b4731] bg-[#1e1c10] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#cdc7aa]">
                  Demo mode
                </span>
              ) : null}
            </div>
            <h1 className="mt-1 text-lg font-semibold tracking-tight text-white">Operaciones del vendedor</h1>
          </div>
          <DashboardHeaderNav />
        </div>
      </header>
      <div className="mx-auto w-full max-w-7xl px-6 py-6">{children}</div>
    </section>
  );
}
