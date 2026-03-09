import LoginComponent from "../../../../components/auth/LoginComponent";
import Navbar from "../../../../components/layout/Navbar";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../../../lib/db/prisma";
import { getSessionUserIdFromCookieStore } from "../../../../lib/auth/session";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const sessionUserId = getSessionUserIdFromCookieStore(cookieStore);

  if (sessionUserId) {
    const user = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: { id: true },
    });
    if (user) {
      redirect("/dashboard");
    }
  }

  return (
    <main className="min-h-screen">
      <Navbar />
      <LoginComponent />
    </main>
  );
}
