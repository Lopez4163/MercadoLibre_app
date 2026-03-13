import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardWorkspace from "../../../../components/dashboard/DashboardWorkspace";
import { getSessionUserIdFromCookieStore } from "../../../../lib/auth/session";
import { getUserBillingEntitlement } from "../../../../lib/billing/entitlements";
import { prisma } from "../../../../lib/db/prisma";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const userId = getSessionUserIdFromCookieStore(cookieStore);

  if (!userId) {
    redirect("/login");
  }

  const [user, entitlement] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        mlUserId: true,
      },
    }),
    getUserBillingEntitlement(userId),
  ]);

  if (!user?.mlUserId) {
    redirect("/connect/ml");
  }

  return (
    <DashboardWorkspace
      mlUserId={user.mlUserId}
      billingHasAccess={entitlement.hasAccess}
      billingStatus={entitlement.status ?? "none"}
    />
  );
}
