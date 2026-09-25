import { redirect } from "next/navigation";

type BillingPageProps = {
  searchParams?: Promise<{ intent?: string | string[] }>;
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const params = (await searchParams) ?? {};
  const intentParam = Array.isArray(params.intent) ? params.intent[0] : params.intent;

  if (intentParam) {
    redirect(`/settings/billing?intent=${encodeURIComponent(intentParam)}`);
  }

  redirect("/settings/billing");
}
