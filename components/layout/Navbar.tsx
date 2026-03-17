import Link from "next/link";
import { cookies } from "next/headers";
import ThemeToggle from "../ui/ThemeToggle";
import { prisma } from "../../lib/db/prisma";
import { getSessionUserIdFromCookieStore } from "../../lib/auth/session";

export default async function Navbar() {
  const cookieStore = await cookies();
  const sessionUserId = getSessionUserIdFromCookieStore(cookieStore);
  const sessionUser = sessionUserId
    ? await prisma.user.findUnique({
        where: { id: sessionUserId },
        select: { id: true },
      })
    : null;

  return (
    <nav className="border-b border-[var(--border-1)] bg-[var(--surface-1)]">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight text-[var(--text-1)]">
          MercadoLibs
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {sessionUser ? (
            <>
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
              >
                Dashboard
              </Link>
              <Link
                href="/billing"
                className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
              >
                Billing
              </Link>
              <Link
                href="/settings/feedback"
                className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
              >
                Feedback
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
                >
                  Logout
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="inline-flex h-9 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
