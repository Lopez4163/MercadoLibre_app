import Navbar from "../../components/layout/Navbar";
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <section className="relative overflow-hidden border-b border-[var(--border-1)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(255,209,0,0.16),transparent_28%),radial-gradient(circle_at_82%_22%,rgba(42,171,238,0.18),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-6 py-12 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-3)]">MercadoLibs Platform</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--text-1)] md:text-6xl">
              Telegram-first operations for Mercado Libre sellers
            </h1>
            <p className="mt-4 max-w-xl text-[var(--text-2)]">
              Monitor inventory, receive sale notifications instantly, and catch sold-out risk before it impacts revenue.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/start-trial"
                className="inline-flex h-11 items-center border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
              >
                Start Free Trial
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-5 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
              >
                View Dashboard
              </Link>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-3)]">Delivery</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-1)]">&lt; 1s</p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-3)]">Channels</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-1)]">ML + TG</p>
              </div>
              <div className="border border-[var(--border-1)] bg-[var(--surface-1)] p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--text-3)]">Setup</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--text-1)]">3 steps</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="absolute -left-6 -top-6 h-24 w-24 border border-[var(--border-1)] bg-[var(--surface-2)]" />
            <div className="absolute -bottom-6 -right-6 h-28 w-28 border border-[var(--border-1)] bg-[var(--surface-2)]" />
            <div className="relative border border-[var(--border-1)] bg-[var(--surface-1)] p-3">
              <Image
                src="/graphics/iphone-telegram.svg"
                alt="iPhone preview showing Telegram stock alerts"
                width={720}
                height={900}
                className="h-auto w-full border border-[var(--border-1)] bg-black"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-6 md:grid-cols-[1.15fr_1fr]">
          <div className="border border-[var(--border-1)] bg-[var(--surface-1)] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-3)]">Mercado Libre Signal Layer</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--text-1)]">Visual control for stock, orders, and risk</h2>
            <p className="mt-3 max-w-2xl text-[var(--text-2)]">
              Every important event is normalized into a clean dashboard and alert flow so your team moves quickly without checking multiple tabs.
            </p>
            <div className="mt-6 border border-[var(--border-1)] bg-black p-2">
              <Image
                src="/graphics/mercadolibre-grid.svg"
                alt="Mercado Libre catalog and stock management preview"
                width={900}
                height={700}
                className="h-auto w-full"
              />
            </div>
          </div>

          <div className="space-y-4">
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Alert Channel</p>
              <div className="mt-3 flex items-center gap-4">
                <Image
                  src="/graphics/telegram-mark.svg"
                  alt="Telegram icon"
                  width={64}
                  height={64}
                  className="h-16 w-16 border border-[var(--border-1)]"
                />
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-[var(--text-1)]">Powered by Telegram</h3>
                  <p className="mt-1 text-sm text-[var(--text-2)]">
                    Sale and stock alerts are delivered directly to your Telegram chat in real time.
                  </p>
                </div>
              </div>
            </article>
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">01 Connect</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">OAuth with Mercado Libre</h3>
              <p className="mt-2 text-sm text-[var(--text-2)]">
                Secure account linking to read listings and orders.
              </p>
            </article>
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">02 Configure</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">Telegram delivery rules</h3>
              <p className="mt-2 text-sm text-[var(--text-2)]">Choose event triggers like every sale or sold-out transitions.</p>
            </article>
            <article className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">03 Operate</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-[var(--text-1)]">React before stock risk grows</h3>
              <p className="mt-2 text-sm text-[var(--text-2)]">Track inventory posture and act on alerts fast.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border-1)] bg-[var(--surface-1)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Ready to launch?</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--text-1)]">
              Connect your account and go live today
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/start-trial"
              className="inline-flex h-11 items-center border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-contrast)] hover:bg-transparent hover:text-[var(--text-1)]"
            >
              Start Free Trial
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center border border-[var(--border-1)] bg-[var(--surface-2)] px-5 text-sm font-semibold text-[var(--text-1)] hover:bg-[var(--surface-1)]"
            >
              Login
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
