import FeedbackSettingsCard from "../../../../../components/dashboard/FeedbackSettingsCard";

export default function SettingsFeedbackPage() {
  return (
    <div className="space-y-4">
      <FeedbackSettingsCard />
      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">Que enviar</h3>
        <ul className="mt-4 space-y-3 text-sm text-[var(--text-2)]">
          <li>Reporta errores con la ruta de la pagina y la accion exacta que fallo.</li>
          <li>Usa solicitud de funcion para flujos, automatizaciones o reportes faltantes.</li>
          <li>Usa UX confusa cuando la app funciona tecnicamente pero el flujo no es claro.</li>
        </ul>
      </section>
    </div>
  );
}
