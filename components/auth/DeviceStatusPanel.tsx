import type { DashboardDevice } from "../../lib/v2/api";

interface DeviceStatusPanelProps {
  device: DashboardDevice;
  removing: boolean;
  onRemove: () => void;
}

export function DeviceStatusPanel({
  device,
  removing,
  onRemove,
}: DeviceStatusPanelProps) {
  return (
    <div className="rounded-xl border border-zinc-300 p-5 dark:border-zinc-700">
      <h2 className="text-xl font-semibold">Connected computer</h2>
      <dl className="mt-4 grid gap-2 text-sm">
        <div><dt className="font-medium">Name</dt><dd>{device.displayName}</dd></div>
        <div><dt className="font-medium">System</dt><dd>{device.systemName}</dd></div>
        <div><dt className="font-medium">Platform</dt><dd>{device.platform}</dd></div>
        <div><dt className="font-medium">Agent version</dt><dd>{device.agentVersion}</dd></div>
        <div>
          <dt className="font-medium">Status</dt>
          <dd>{device.online ? "Online" : "Offline"}</dd>
        </div>
        <div>
          <dt className="font-medium">Last seen</dt>
          <dd>{new Date(device.lastSeenAt).toLocaleString()}</dd>
        </div>
        {device.systemBlocked && (
          <div><dt className="font-medium">Queue</dt><dd>Needs attention</dd></div>
        )}
      </dl>
      <button
        className="mt-5 rounded-lg border border-red-600 px-4 py-2 font-semibold text-red-700 disabled:opacity-50 dark:text-red-400"
        disabled={removing}
        onClick={onRemove}
        type="button"
      >
        {removing ? "Disconnecting…" : "Disconnect computer"}
      </button>
    </div>
  );
}
