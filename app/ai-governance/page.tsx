import { redirect } from "next/navigation";
import { AIGovernanceWorkspace } from "@/components/AIGovernanceWorkspace";
import { TrialAccessMonitor } from "@/components/TrialAccessMonitor";
import { requireSession } from "@/src/lib/server/auth";
import { isDesignatedAdminEmail } from "@/src/lib/server/admin-access";

export default async function AIGovernancePage() {
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHORIZED";
    if (message === "TRIAL_EXPIRED" || message === "SUBSCRIPTION_REQUIRED") redirect("/trial-expired?from=/ai-governance");
    redirect("/login?from=/ai-governance");
  }
  if (!isDesignatedAdminEmail(session.email)) redirect("/dashboard");
  return <><TrialAccessMonitor /><AIGovernanceWorkspace /></>;
}
