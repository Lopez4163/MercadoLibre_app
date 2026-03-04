import Link from "next/link";

const mlAuthUrl = `https://auth.mercadolibre.com.co/authorization?response_type=code&client_id=${process.env.NEXT_PUBLIC_ML_CLIENT_ID}&redirect_uri=${process.env.NEXT_PUBLIC_ML_REDIRECT_URL}&scope=read_listings%20read_orders%20offline_access%20write_listings`;
export default function LoginComponent() {
  return (
    <section className="mx-auto mt-12 w-full max-w-md border border-[var(--border-1)] bg-[var(--surface-1)] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
        Seller Access
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-1)]">Login</h1>
      <p className="mt-2 text-sm text-[var(--text-2)]">
        Connect your Mercado Libre account to continue.
      </p>

      <a
        href={mlAuthUrl}
        className="mt-6 inline-flex h-11 w-full items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
      >
        Continue with Mercado Libre
      </a>

      <p className="mt-4 text-center text-sm text-[var(--text-2)]">
        No account yet?{" "}
        <Link href="/register" className="font-semibold text-[var(--text-1)] underline">
          Register
        </Link>
      </p>
    </section>
  );
}
