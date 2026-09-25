import LoginComponent from "../../../../components/auth/LoginComponent";
import Navbar from "../../../../components/layout/Navbar";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../../../lib/db/prisma";
import { getSessionUserIdFromCookieStore } from "../../../../lib/auth/session";
import { normalizeNextPath } from "../../../../lib/auth/next-path";

type LoginPageProps = {
  searchParams?: Promise<{ next?: string | string[] }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const cookieStore = await cookies();
  const sessionUserId = getSessionUserIdFromCookieStore(cookieStore);
  const params = (await searchParams) ?? {};
  const nextValue = Array.isArray(params.next) ? params.next[0] : params.next;
  const safeNext = normalizeNextPath(nextValue);

  if (sessionUserId) {
    const user = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { id: true },
    });
    if (user) {
      redirect(safeNext ?? "/dashboard");
    }
  }

  return (
    <main className="min-h-screen">
      <Navbar />
      <LoginComponent nextPath={safeNext} />
    </main>
  );
}
