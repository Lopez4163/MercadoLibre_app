import { prisma } from "../db/prisma";

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["trialing", "active"]);

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
    hasAccess: status ? ACTIVE_SUBSCRIPTION_STATUSES.has(status) : false,
    status,
  };
}

export async function hasUserBillingAccess(userId: string) {
  const entitlement = await getUserBillingEntitlement(userId);
  return entitlement.hasAccess;
}
