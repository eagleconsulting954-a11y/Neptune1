import Link from "next/link";
import { DashboardApp } from "@/components/DashboardApp";
import { TrialAccessMonitor } from "@/components/TrialAccessMonitor";

export default function DashboardPage() {
  return (
    <>
      <TrialAccessMonitor />
      <DashboardApp />
      <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 80, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <Link href="/passkeys" className="btn" style={{ boxShadow: "0 14px 36px rgba(0,0,0,.28)" }}>Passkeys</Link>
        <Link href="/security-center" className="btn gold" style={{ boxShadow: "0 14px 36px rgba(0,0,0,.28)" }}>Security Center</Link>
      </div>
    </>
  );
}
