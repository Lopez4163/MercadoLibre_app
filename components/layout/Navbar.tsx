import Link from "next/link";
import { cookies } from "next/headers";
import Image from "next/image";
import ThemeToggle from "../ui/ThemeToggle";
import { prisma } from "../../lib/db/prisma";
import { getSessionUserIdFromCookieStore } from "../../lib/auth/session";
import { isDemoMode } from "../../lib/demo-mode";

export default async function Navbar() {
  const demoMode = isDemoMode();
  const cookieStore = await cookies();
  const sessionUserId = getSessionUserIdFromCookieStore(cookieStore);
  const sessionUser = !demoMode && sessionUserId
    ? await prisma.user.findUnique({
        where: { id: sessionUserId },
        select: { id: true },
      })
    : null;

  return (
    <nav className="sticky top-0 z-50 border-b border-[#2d2e35] bg-[#151408]/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-5 px-6 py-4">
        <Link href="/" className="flex items-center" aria-label="MercadoLibs inicio">
          <Image
            src="/images/logo/notiventa-logo-transparent.png"
            alt="NotiVenta"
            width={1234}
            height={247}
            className="h-9 w-[180px] object-contain object-left"
            priority
          />
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <Link href="/#panel" className="text-sm font-semibold text-[#cdc7aa] hover:text-[#fde400]">
            Producto
          </Link>
          <Link href="/dashboard" className="text-sm font-semibold text-[#cdc7aa] hover:text-[#fde400]">
            Panel
          </Link>
          <Link href="/#precios" className="text-sm font-semibold text-[#cdc7aa] hover:text-[#fde400]">
            Precios
          </Link>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          {sessionUser ? (
            <>
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center rounded border border-[#4b4731] bg-[#1e1c10] px-4 text-sm font-semibold text-white hover:border-[#85cfff]"
              >
                Panel
              </Link>
              <Link
                href="/billing"
                className="hidden h-9 items-center rounded border border-[#4b4731] bg-[#1e1c10] px-4 text-sm font-semibold text-white hover:border-[#85cfff] lg:inline-flex"
              >
                Facturacion
              </Link>
              <Link
                href="/settings/feedback"
                className="hidden h-9 items-center rounded border border-[#4b4731] bg-[#1e1c10] px-4 text-sm font-semibold text-white hover:border-[#85cfff] lg:inline-flex"
              >
                Comentarios
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded border border-[#4b4731] bg-[#1e1c10] px-4 text-sm font-semibold text-white hover:border-[#85cfff]"
                >
                  Cerrar sesion
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href={demoMode ? "/dashboard" : "/login"}
                className="inline-flex h-9 items-center rounded bg-[#fde400] px-4 text-sm font-bold text-[#373100] hover:brightness-110"
              >
                {demoMode ? "Ver demo" : "Iniciar sesion"}
              </Link>
              {!demoMode ? (
                <Link
                  href="/register"
                  className="hidden h-9 items-center rounded border border-[#4b4731] bg-[#1e1c10] px-4 text-sm font-semibold text-white hover:border-[#85cfff] sm:inline-flex"
                >
                  Registrarse
                </Link>
              ) : null}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
