import Link from "next/link";

type LoginComponentProps = {
  nextPath?: string | null;
};

export default function LoginComponent(props: LoginComponentProps) {
  const oauthStartHref = props.nextPath
    ? `/api/ml/oauth/start?next=${encodeURIComponent(props.nextPath)}`
    : "/api/ml/oauth/start";

  return (
    <section className="mx-auto mt-12 w-full max-w-md border border-[var(--border-1)] bg-[var(--surface-1)] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
        Acceso vendedor
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-1)]">Iniciar sesion</h1>
      <p className="mt-2 text-sm text-[var(--text-2)]">
        Conecta tu cuenta de Mercado Libre para continuar.
      </p>

      <a
        href={oauthStartHref}
        className="mt-6 inline-flex h-11 w-full items-center justify-center border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
      >
        Continuar con Mercado Libre
      </a>

      <p className="mt-4 text-center text-sm text-[var(--text-2)]">
        Aun no tienes cuenta?{" "}
        <Link href="/register" className="font-semibold text-[var(--text-1)] underline">
          Registrate
        </Link>
      </p>
    </section>
  );
}
