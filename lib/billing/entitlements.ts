import { prisma } from "../db/prisma";

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["trialing", "active"]);

export function isBillingStatusActive(status: string | null | undefined) {
  if (!status) {
    return false;
  }

  return ACTIVE_SUBSCRIPTION_STATUSES.has(status);
}

export type BillingEntitlement = {
  hasAccess: boolean;
  status: string | null;
};

export async function getUserBillingEntitlement(userId: string): Promise<BillingEntitlement> {
  const subscription = await prisma.billingSubscription.findUnique({
    where: { userId },
    select: { status: true },
  });

  const status = subscription?.status ?? null;
  return {
    hasAccess: isBillingStatusActive(status),
    status,
  };
}

export async function hasUserBillingAccess(userId: string) {
  const entitlement = await getUserBillingEntitlement(userId);
  return entitlement.hasAccess;
}
