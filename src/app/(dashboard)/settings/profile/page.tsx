import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../../../../lib/db/prisma";
import { getSessionUserIdFromCookieStore } from "../../../../../lib/auth/session";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatOptionalDate(value: Date | null | undefined) {
  if (!value) {
    return "N/A";
  }

  return formatDate(value);
}

function maskChatId(chatId: string | null | undefined) {
  if (!chatId) {
    return "N/A";
  }

  if (chatId.length <= 4) {
    return "*".repeat(chatId.length);
  }

  return `${chatId.slice(0, 2)}***${chatId.slice(-2)}`;
}

function storeInitial(user: { mlNickname: string | null; email: string }) {
  const source = user.mlNickname?.trim() || user.email.trim();
  const first = source[0];
  return first ? first.toUpperCase() : "?";
}

export default async function SettingsProfilePage() {
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
      mlAvatarUrl: true,
      accessToken: true,
      refreshToken: true,
      createdAt: true,
      telegramAccount: {
        select: {
          chatId: true,
        },
      },
      billingSubscription: {
        select: {
          status: true,
          priceId: true,
          trialEnd: true,
          currentPeriodEnd: true,
        },
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  const mlConnected = Boolean(user.accessToken) && Boolean(user.refreshToken);
  const telegramConnected = Boolean(user.telegramAccount?.chatId);

  return (
    <div className="space-y-4">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-3)]">Store image</p>
          <div className="mt-3 h-20 w-20 border border-[var(--border-1)] bg-[var(--surface-2)] p-1">
            {user.mlAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.mlAvatarUrl}
                alt="Store profile"
                className="h-full w-full object-contain"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="inline-flex h-full w-full items-center justify-center text-sm font-semibold text-[var(--text-1)]">
                {storeInitial(user)}
              </div>
            )}
          </div>
        </article>
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
            {telegramConnected ? "Connected" : "Not connected"}
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
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Connections</h3>
        <dl className="mt-4 grid gap-3 text-sm text-[var(--text-2)] md:grid-cols-2">
          <div>
            <dt className="text-[var(--text-3)]">Mercado Libre</dt>
            <dd className="mt-1 font-medium text-[var(--text-1)]">
              {mlConnected ? "Connected" : "Disconnected"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--text-3)]">Telegram</dt>
            <dd className="mt-1 font-medium text-[var(--text-1)]">
              {telegramConnected ? "Connected" : "Not connected"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--text-3)]">Telegram chat ID</dt>
            <dd className="mt-1 font-medium text-[var(--text-1)]">{maskChatId(user.telegramAccount?.chatId)}</dd>
          </div>
        </dl>
      </section>

      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Account details</h3>
        <dl className="mt-4 grid gap-3 text-sm text-[var(--text-2)] md:grid-cols-2">
          <div>
            <dt className="text-[var(--text-3)]">Joined</dt>
            <dd className="mt-1 font-medium text-[var(--text-1)]">{formatDate(user.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Billing snapshot</h3>
        <dl className="mt-4 grid gap-3 text-sm text-[var(--text-2)] md:grid-cols-2">
          <div>
            <dt className="text-[var(--text-3)]">Subscription status</dt>
            <dd className="mt-1 font-medium capitalize text-[var(--text-1)]">
              {user.billingSubscription?.status ?? "none"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--text-3)]">Plan (Price ID)</dt>
            <dd className="mt-1 font-medium text-[var(--text-1)]">{user.billingSubscription?.priceId ?? "N/A"}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-3)]">Trial end</dt>
            <dd className="mt-1 font-medium text-[var(--text-1)]">
              {formatOptionalDate(user.billingSubscription?.trialEnd)}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--text-3)]">Next renewal</dt>
            <dd className="mt-1 font-medium text-[var(--text-1)]">
              {formatOptionalDate(user.billingSubscription?.currentPeriodEnd)}
            </dd>
          </div>
        </dl>
        <a
          href="/billing"
          className="mt-4 inline-flex h-10 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
        >
          Manage billing
        </a>
      </section>
    </div>
  );
}
