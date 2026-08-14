import { redirect } from "next/navigation";
import { SecurityCenter } from "@/components/SecurityCenter";
import { TrialAccessMonitor } from "@/components/TrialAccessMonitor";
import { requireSession } from "@/src/lib/server/auth";

export default async function SecurityCenterPage() {
  try {
    await requireSession();
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHORIZED";
    if (message === "TRIAL_EXPIRED" || message === "SUBSCRIPTION_REQUIRED") redirect("/trial-expired?from=/security-center");
    redirect("/login?from=/security-center");
  }
  return <><TrialAccessMonitor /><SecurityCenter /></>;
}
