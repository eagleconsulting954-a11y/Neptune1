import Link from "next/link";
import { DashboardApp } from "@/components/DashboardApp";
import { TrialAccessMonitor } from "@/components/TrialAccessMonitor";

export default function DashboardPage() {
  return (
    <>
      <TrialAccessMonitor />
      <DashboardApp />
      <Link href="/security-center" className="btn" style={{ position: "fixed", right: 18, bottom: 18, zIndex: 80, boxShadow: "0 14px 36px rgba(0,0,0,.28)" }}>Security Center</Link>
    </>
  );
}
