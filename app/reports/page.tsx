import { redirect } from "next/navigation";
import { ReportCenter } from "@/components/ReportCenter";
import { TrialAccessMonitor } from "@/components/TrialAccessMonitor";
import { requireSession } from "@/src/lib/server/auth";

export default async function ReportsPage() {
  try {
    await requireSession();
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHORIZED";
    if (message === "TRIAL_EXPIRED" || message === "SUBSCRIPTION_REQUIRED") redirect("/trial-expired?from=/reports");
    redirect("/login?from=/reports");
  }
  return <><TrialAccessMonitor /><ReportCenter /></>;
}
