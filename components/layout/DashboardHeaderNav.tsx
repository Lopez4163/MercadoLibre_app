"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "../ui/ThemeToggle";

type HeaderLink = {
  href: string;
  label: string;
};

const HEADER_LINKS: HeaderLink[] = [
  { href: "/dashboard", label: "Panel" },
  { href: "/settings/notifications", label: "Configuracion" },
  { href: "/settings/profile", label: "Perfil" },
];

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const headerButtonClass =
  "inline-flex h-9 items-center rounded border border-[#4b4731] bg-[#1e1c10] px-3 text-sm font-semibold text-white transition-all duration-150 hover:border-[#85cfff] hover:bg-[#14151a] active:translate-y-px active:scale-[0.99]";

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function DashboardHeaderNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-3">
      {HEADER_LINKS.filter((link) => !isCurrentPath(pathname, link.href)).map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={headerButtonClass}
        >
          {link.label}
        </Link>
      ))}
      {!isCurrentPath(pathname, "/settings/feedback") ? (
        <Link
          href={`/settings/feedback?from=${encodeURIComponent(pathname)}`}
          className={headerButtonClass}
        >
          Comentarios
        </Link>
      ) : null}
      <ThemeToggle />
      {isDemoMode ? (
        <Link
          href="/"
          className="inline-flex h-9 items-center rounded bg-[#fde400] px-3 text-sm font-bold text-[#373100] transition-all duration-150 hover:brightness-110 active:translate-y-px active:scale-[0.99]"
        >
          Landing
        </Link>
      ) : (
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className={headerButtonClass}
          >
            Cerrar sesion
          </button>
        </form>
      )}
    </div>
  );
}
