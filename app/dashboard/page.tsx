import { DashboardApp } from "@/components/DashboardApp";
import { TrialAccessMonitor } from "@/components/TrialAccessMonitor";

export default function DashboardPage() {
  return (
    <>
      <TrialAccessMonitor />
      <DashboardApp />
    </>
  );
}
