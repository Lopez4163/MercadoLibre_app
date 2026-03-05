import LoginComponent from "../../../../components/auth/LoginComponent";
import Navbar from "../../../../components/layout/Navbar";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../../../lib/db/prisma";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const sessionUserId = cookieStore.get("ml_user_id")?.value;

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
