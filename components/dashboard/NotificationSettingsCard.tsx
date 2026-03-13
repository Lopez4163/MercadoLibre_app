import NotificationRulesCard from "./NotificationRulesCard";
import TelegramSettingsCard from "./TelegramSettingsCard";

export default function NotificationSettingsCard() {
  return (
    <div className="space-y-4">
      <NotificationRulesCard />
      <TelegramSettingsCard />
    </div>
  );
}
