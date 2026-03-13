import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../../../lib/db/prisma";
import { getSessionUserIdFromCookieStore } from "../../../../lib/auth/session";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const sessionUserId = getSessionUserIdFromCookieStore(cookieStore);

  if (!sessionUserId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: {
      email: true,
      mlUserId: true,
      mlNickname: true,
      createdAt: true,
      telegramAccount: {
        select: {
          chatId: true,
        },
      },
      billingSubscription: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Profile</p>
        <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-1)] md:text-4xl">Account overview</h2>
        <p className="text-sm text-[var(--text-2)]">Core account and connection details for the logged-in seller.</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Email</p>
          <p className="mt-3 text-base font-semibold text-[var(--text-1)]">{user.email}</p>
        </article>
        <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Store name</p>
          <p className="mt-3 text-base font-semibold text-[var(--text-1)]">{user.mlNickname ?? "N/A"}</p>
        </article>
        <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">ML User ID</p>
          <p className="mt-3 text-base font-semibold text-[var(--text-1)]">{user.mlUserId}</p>
        </article>
        <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Telegram</p>
          <p className="mt-3 text-base font-semibold text-[var(--text-1)]">
            {user.telegramAccount?.chatId ? "Connected" : "Not connected"}
          </p>
        </article>
        <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Billing</p>
          <p className="mt-3 text-base font-semibold capitalize text-[var(--text-1)]">
            {user.billingSubscription?.status ?? "none"}
          </p>
        </article>
      </section>

      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Account details</h3>
        <dl className="mt-4 grid gap-3 text-sm text-[var(--text-2)] md:grid-cols-2">
          <div>
            <dt className="text-[var(--text-3)]">Joined</dt>
            <dd className="mt-1 font-medium text-[var(--text-1)]">{formatDate(user.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-3)]">Telegram chat ID</dt>
            <dd className="mt-1 font-medium text-[var(--text-1)]">{user.telegramAccount?.chatId ?? "N/A"}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
