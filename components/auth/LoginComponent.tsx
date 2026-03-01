import Link from "next/link";

const mlAuthUrl = `https://auth.mercadolibre.com.co/authorization?response_type=code&client_id=${process.env.NEXT_PUBLIC_ML_CLIENT_ID}&redirect_uri=${process.env.NEXT_PUBLIC_ML_REDIRECT_URL}`;

export default function LoginComponent() {
  return (
    <section className="mx-auto mt-12 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Login</h1>
      <p className="mt-2 text-sm text-slate-600">
        Connect your Mercado Libre account to continue.
      </p>

      <a
        href={mlAuthUrl}
        className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Continue with Mercado Libre
      </a>

      <p className="mt-4 text-center text-sm text-slate-600">
        No account yet?{" "}
        <Link href="/register" className="font-medium text-slate-900 underline">
          Register
        </Link>
      </p>
    </section>
  );
}
