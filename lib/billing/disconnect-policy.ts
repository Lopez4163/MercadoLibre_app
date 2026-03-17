import { isBillingStatusActive } from "./entitlements";

export const BILLING_DISCONNECT_GRACE_MS = 24 * 60 * 60 * 1000;

const TERMINAL_DISCONNECT_STATUSES = new Set(["canceled", "incomplete_expired"]);
const GRACE_DISCONNECT_STATUSES = new Set(["past_due", "unpaid"]);

function isNonEntitled(status: string | null | undefined) {
  return Boolean(status) && !isBillingStatusActive(status);
}

type DegradedSinceInput = {
  status: string;
  previousStatus: string | null;
  previousDegradedSince: Date | null;
  now: Date;
};

export function resolveDegradedSince(input: DegradedSinceInput) {
  if (!isNonEntitled(input.status)) {
    return null;
  }

  if (isNonEntitled(input.previousStatus) && input.previousDegradedSince) {
    return input.previousDegradedSince;
  }

  return input.now;
}

export function shouldDisconnectForBillingStatus(status: string, degradedSince: Date | null, now: Date) {
  if (TERMINAL_DISCONNECT_STATUSES.has(status)) {
    return true;
  }

  if (!GRACE_DISCONNECT_STATUSES.has(status)) {
    return false;
  }

  if (!degradedSince) {
    return false;
  }

  return now.getTime() - degradedSince.getTime() >= BILLING_DISCONNECT_GRACE_MS;
}
