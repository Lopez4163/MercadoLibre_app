import FeedbackSettingsCard from "../../../../../components/dashboard/FeedbackSettingsCard";

export default function SettingsFeedbackPage() {
  return (
    <div className="space-y-4">
      <FeedbackSettingsCard />
      <section className="border border-[var(--border-1)] bg-[var(--surface-1)] p-5">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--text-1)]">What to send</h3>
        <ul className="mt-4 space-y-3 text-sm text-[var(--text-2)]">
          <li>Report bugs with the page path and the exact action that failed.</li>
          <li>Use feature requests for missing workflows, automations, or reporting needs.</li>
          <li>Use confusing UX when the app technically works but the flow is unclear.</li>
        </ul>
      </section>
    </div>
  );
}
