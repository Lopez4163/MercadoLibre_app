export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["trialing", "active"]);

export function isBillingStatusActive(status: string | null | undefined) {
  if (!status) {
    return false;
  }

  return ACTIVE_SUBSCRIPTION_STATUSES.has(status);
}
