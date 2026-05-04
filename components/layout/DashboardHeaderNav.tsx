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
          className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-sm font-semibold text-[var(--text-1)] transition-all duration-150 hover:border-[var(--text-2)] hover:bg-[var(--surface-1)] active:translate-y-px active:scale-[0.99] active:bg-[var(--bg-0)]"
        >
          {link.label}
        </Link>
      ))}
      {!isCurrentPath(pathname, "/settings/feedback") ? (
        <Link
          href={`/settings/feedback?from=${encodeURIComponent(pathname)}`}
          className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-sm font-semibold text-[var(--text-1)] transition-all duration-150 hover:border-[var(--text-2)] hover:bg-[var(--surface-1)] active:translate-y-px active:scale-[0.99] active:bg-[var(--bg-0)]"
        >
          Comentarios
        </Link>
      ) : null}
      <ThemeToggle />
      {isDemoMode ? (
        <Link
          href="/"
          className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-sm font-semibold text-[var(--text-1)] transition-all duration-150 hover:border-[var(--text-2)] hover:bg-[var(--surface-1)] active:translate-y-px active:scale-[0.99] active:bg-[var(--bg-0)]"
        >
          Landing
        </Link>
      ) : (
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-sm font-semibold text-[var(--text-1)] transition-all duration-150 hover:border-[var(--text-2)] hover:bg-[var(--surface-1)] active:translate-y-px active:scale-[0.99] active:bg-[var(--bg-0)]"
          >
            Cerrar sesion
          </button>
        </form>
      )}
    </div>
  );
}
