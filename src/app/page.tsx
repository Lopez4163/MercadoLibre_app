import Navbar from "../../components/layout/Navbar";
import Link from "next/link";
import Image from "next/image";
import ProductShowcase from "../../components/marketing/ProductShowcase";
import { isDemoMode } from "../../lib/demo-mode";

export default function HomePage() {
  const demoMode = isDemoMode();
  const primaryHref = demoMode ? "/dashboard" : "/start-trial";
  const primaryLabel = demoMode ? "Ver demo en vivo" : "Iniciar prueba gratis";
  const secondaryHref = demoMode ? "#inside-panel" : "/dashboard";
  const secondaryLabel = demoMode ? "Ver pantallas" : "Ver panel";

  return (
    <main className="min-h-screen">
      <Navbar />
      {demoMode ? (
        <section className="border-b border-[var(--border-1)] bg-[var(--surface-2)]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
            <p className="text-sm text-[var(--text-2)]">
              <span className="font-semibold text-[var(--text-1)]">Portfolio demo:</span> explore the product with
              sample data. Live integrations are disabled for public viewing.
            </p>
          </div>
        </section>
      ) : null}
      <section className="relative overflow-hidden border-b border-[var(--border-1)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(255,209,0,0.16),transparent_28%),radial-gradient(circle_at_82%_22%,rgba(42,171,238,0.18),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-3)]">Plataforma MercadoLibs</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--text-1)] md:text-6xl">
              Operaciones para vendedores de Mercado Libre, con Telegram primero
            </h1>
            <p className="mt-4 max-w-xl text-[var(--text-2)]">
              Monitorea inventario, recibe notificaciones de venta al instante y detecta riesgo de quiebre de stock antes de afectar ingresos.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={primaryHref}
                className="inline-flex h-11 items-center border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
              >
                {primaryLabel}
              </Link>
              <Link
                href={secondaryHref}
                className="inline-flex h-11 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-5 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
              >
                {secondaryLabel}
              </Link>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-3)]">Entrega</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-1)]">&lt; 1s</p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-3)]">Canales</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-1)]">ML + TG</p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-3)]">Configuracion</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-1)]">3 pasos</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -left-6 -top-6 h-24 w-24 border border-[var(--border-1)] bg-[var(--surface-2)]" />
            <div className="absolute -bottom-6 -right-6 h-28 w-28 border border-[var(--border-1)] bg-[var(--surface-2)]" />
            <div className="relative border border-[var(--border-1)] bg-[var(--surface-1)] p-3">
              <Image
                src="/graphics/iphone-telegram.svg"
                alt="Vista previa en iPhone con alertas de stock en Telegram"
                width={720}
                height={900}
                className="h-auto w-full border border-[var(--border-1)] bg-black"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <section id="inside-panel" className="mx-auto max-w-6xl px-6 py-14">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-3)]">Dentro del panel</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-1)] md:text-4xl">
            Mira pedidos, tendencias y riesgo operativo en el producto
          </h2>
          <p className="mt-3 text-[var(--text-2)]">
            Pantallas reales de la app, organizadas como trabaja tu equipo cada dia.
            {demoMode ? " Esta version publica usa datos de muestra para mostrar el flujo sin conectar cuentas reales." : ""}
          </p>
        </div>
        <div className="mt-8">
          <ProductShowcase />
        </div>
      </section>

      <section className="border-t border-[var(--border-1)]">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-3)]">Precios</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-1)] md:text-4xl">
              Un plan beta simple
            </h2>
            <p className="mt-3 text-[var(--text-2)]">
              Empieza con un solo plan mientras ampliamos funciones con usuarios iniciales.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-2xl border border-[var(--border-1)] bg-[var(--surface-1)] p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border-1)] pb-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-3)]">MercadoLibs Beta</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-1)]">$5/mes</h3>
              </div>
              <p className="border border-[var(--accent)] bg-[var(--accent)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-contrast)]">
                Precio de acceso temprano
              </p>
            </div>

            <ul className="mt-5 grid gap-3 text-sm text-[var(--text-2)]">
              <li className="border border-[var(--border-1)] bg-[var(--surface-2)] px-4 py-3">Alertas de ventas por Telegram en tiempo real</li>
              <li className="border border-[var(--border-1)] bg-[var(--surface-2)] px-4 py-3">
                Notificaciones de bajo stock y riesgo de quiebre
              </li>
              <li className="border border-[var(--border-1)] bg-[var(--surface-2)] px-4 py-3">
                Panel de inventario, pedidos y controles de notificaciones
              </li>
              <li className="border border-[var(--border-1)] bg-[var(--surface-2)] px-4 py-3">
                Cobro con Stripe para cancelar o reanudar en cualquier momento
              </li>
            </ul>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={primaryHref}
                className="inline-flex h-11 items-center border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
              >
                {primaryLabel}
              </Link>
              <Link
                href={demoMode ? "/dashboard" : "/settings/billing"}
                className="inline-flex h-11 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-5 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
              >
                {demoMode ? "Ver demo" : "Ver facturacion"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border-1)] bg-[var(--surface-1)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Listo para lanzar?</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-1)]">
              Conecta tu cuenta y publica hoy
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={primaryHref}
              className="inline-flex h-11 items-center border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
            >
              {primaryLabel}
            </Link>
            <Link
              href={demoMode ? "/dashboard" : "/login"}
              className="inline-flex h-11 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-5 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
            >
              {demoMode ? "Abrir panel" : "Iniciar sesion"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
