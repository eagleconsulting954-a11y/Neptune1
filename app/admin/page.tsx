import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { TrialAccessMonitor } from "@/components/TrialAccessMonitor";
import { requireSession } from "@/src/lib/server/auth";
import { canAccessModule } from "@/src/lib/plans";

export default async function AdminPage() {
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNAUTHORIZED";
    if (message === "TRIAL_EXPIRED" || message === "SUBSCRIPTION_REQUIRED") redirect("/trial-expired");
    redirect("/login?from=/admin");
  }

  if (session.role !== "admin") redirect("/dashboard");
  if (!canAccessModule(session.entitlement.plan, "analytics")) redirect("/pricing?required=analytics");

  return (
    <>
      <TrialAccessMonitor />
      <AdminDashboard />
    </>
  );
}
