import { redirect } from "next/navigation";
import { PasskeyManager } from "@/components/PasskeyManager";
import { TrialAccessMonitor } from "@/components/TrialAccessMonitor";
import { requireSession } from "@/src/lib/server/auth";

export default async function PasskeysPage() {
  try {
    await requireSession();
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHORIZED";
    if (message === "TRIAL_EXPIRED" || message === "SUBSCRIPTION_REQUIRED") redirect("/trial-expired?from=/passkeys");
    redirect("/login?from=/passkeys");
  }
  return <><TrialAccessMonitor /><PasskeyManager /></>;
}
