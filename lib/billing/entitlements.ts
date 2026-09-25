import { prisma } from "../db/prisma";
import { isBillingStatusActive } from "./status";

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
