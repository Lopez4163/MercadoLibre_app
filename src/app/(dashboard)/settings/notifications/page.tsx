import NotificationRulesCard from "../../../../../components/dashboard/NotificationRulesCard";

export default function SettingsNotificationsPage() {
  return (
    <div className="space-y-4">
      <NotificationRulesCard />
      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">How alerts behave</h3>
        <ul className="mt-4 space-y-3 text-sm text-[var(--text-2)]">
          <li>Sale alerts are sent whenever a new order matches your notification rules.</li>
          <li>Sold-out alerts fire when an item moves from positive stock to zero.</li>
          <li>Low-stock alerts trigger when available quantity crosses below your configured threshold.</li>
        </ul>
      </section>
    </div>
  );
}
