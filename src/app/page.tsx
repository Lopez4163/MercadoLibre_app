import Navbar from "../../components/layout/Navbar";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Navbar />
      <section className="mx-auto max-w-5xl px-6 py-14">
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">
            Telegram Alerts for Mercado Libre Sellers
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Connect your account and get real-time notifications when stock runs out or drops below your threshold.
          </p>
        </div>
      </section>
    </main>
  );
}
