import { redirect } from "next/navigation";
import { ApprovalCenter } from "@/components/ApprovalCenter";
import { TrialAccessMonitor } from "@/components/TrialAccessMonitor";
import { requireSession } from "@/src/lib/server/auth";

export default async function ApprovalsPage() {
  try {
    await requireSession();
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHORIZED";
    if (message === "TRIAL_EXPIRED" || message === "SUBSCRIPTION_REQUIRED") redirect("/trial-expired?from=/approvals");
    redirect("/login?from=/approvals");
  }
  return <><TrialAccessMonitor /><ApprovalCenter /></>;
}
