"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "../ui/ThemeToggle";

type HeaderLink = {
  href: string;
  label: string;
};

const HEADER_LINKS: HeaderLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
  { href: "/settings/profile", label: "Profile" },
];

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
          className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
        >
          {link.label}
        </Link>
      ))}
      <ThemeToggle />
      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-3 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
        >
          Logout
        </button>
      </form>
    </div>
  );
}
