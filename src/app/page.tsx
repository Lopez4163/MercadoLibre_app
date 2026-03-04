import Navbar from "../../components/layout/Navbar";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <section className="mx-auto max-w-5xl px-6 py-14">
        <div className="border border-[var(--border-1)] bg-[var(--surface-1)] p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">
            MVP Notifications
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text-1)] md:text-4xl">
            Telegram Alerts for Mercado Libre Sellers
          </h1>
          <p className="mt-4 max-w-2xl text-[var(--text-2)]">
            Connect your account and receive instant inventory alerts when stock hits zero or drops below your defined threshold.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-[var(--text-2)] md:grid-cols-3">
            <div className="border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
              OAuth connection with Mercado Libre
            </div>
            <div className="border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
              Telegram notifications with low-stock and sold-out events
            </div>
            <div className="border border-[var(--border-1)] bg-[var(--surface-2)] p-4">
              Automatic refresh lifecycle for access tokens
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
