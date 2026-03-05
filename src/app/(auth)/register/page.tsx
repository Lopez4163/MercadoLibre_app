import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navbar from "../../../../components/layout/Navbar";
import { prisma } from "../../../../lib/db/prisma";

const mlAuthUrl = `https://auth.mercadolibre.com.co/authorization?response_type=code&client_id=${process.env.NEXT_PUBLIC_ML_CLIENT_ID}&redirect_uri=${process.env.NEXT_PUBLIC_ML_REDIRECT_URL}&scope=read_listings%20read_orders%20offline_access%20write_listings`;

export default async function RegisterPage() {
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
      <section className="mx-auto mt-12 w-full max-w-md border border-[var(--border-1)] bg-[var(--surface-1)] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Create Account</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-1)]">Sign up</h1>
        <p className="mt-2 text-sm text-[var(--text-2)]">
          Use Mercado Libre OAuth to create your account and link your seller profile.
        </p>

        <a
          href={mlAuthUrl}
          className="mt-6 inline-flex h-11 w-full items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
        >
          Sign up with Mercado Libre
        </a>

        <p className="mt-4 text-center text-sm text-[var(--text-2)]">
          Already have access?{" "}
          <Link href="/login" className="font-semibold text-[var(--text-1)] underline">
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}
