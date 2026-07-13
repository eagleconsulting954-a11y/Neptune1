import { AdminDashboard } from "@/components/AdminDashboard";
import { TrialAccessMonitor } from "@/components/TrialAccessMonitor";

export default function AdminPage() {
  return (
    <>
      <TrialAccessMonitor />
      <AdminDashboard />
    </>
  );
}
