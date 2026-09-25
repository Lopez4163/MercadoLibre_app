import type { ReactNode } from "react";
import SettingsSidebarNav from "../../../../components/layout/SettingsSidebarNav";
import SettingsContentTransition from "../../../../components/layout/SettingsContentTransition";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <main className="space-y-6">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-3)]">Configuracion</p>
        <h2 className="text-3xl font-semibold tracking-tight text-[var(--text-1)] md:text-4xl">
          Configuracion operativa
        </h2>
        <p className="text-sm text-[var(--text-2)]">
          Configura entregas, alertas, facturacion, conexiones de cuenta y comentarios desde un solo lugar.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <SettingsSidebarNav />
        </aside>
        <div className="self-start">
          <SettingsContentTransition>{children}</SettingsContentTransition>
        </div>
      </section>
    </main>
  );
}
