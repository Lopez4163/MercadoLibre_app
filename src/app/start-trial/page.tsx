import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUserIdFromCookieStore } from "../../../lib/auth/session";
import { isDemoMode } from "../../../lib/demo-mode";

const BILLING_TRIAL_PATH = "/billing?intent=trial";

export default async function StartTrialPage() {
  if (isDemoMode()) {
    redirect("/dashboard");
  }

  const cookieStore = await cookies();
  const userId = getSessionUserIdFromCookieStore(cookieStore);

  if (userId) {
    redirect(BILLING_TRIAL_PATH);
  }

  redirect(`/login?next=${encodeURIComponent(BILLING_TRIAL_PATH)}`);
}
