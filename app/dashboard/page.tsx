import Link from "next/link";
import { DashboardApp } from "@/components/DashboardApp";
import { TrialAccessMonitor } from "@/components/TrialAccessMonitor";

export default function DashboardPage() {
  return (
    <>
      <TrialAccessMonitor />
      <DashboardApp />
      <Link className="dashboard-admin-link" href="/admin">CRM & Analytics Admin</Link>
    </>
  );
}
