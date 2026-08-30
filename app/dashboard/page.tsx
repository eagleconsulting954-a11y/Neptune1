import Link from "next/link";
import { DashboardApp } from "@/components/DashboardApp";
import { TrialAccessMonitor } from "@/components/TrialAccessMonitor";
import { getSession } from "@/src/lib/server/auth";
import { isDesignatedAdminEmail } from "@/src/lib/server/admin-access";

export default async function DashboardPage() {
  const session = await getSession();
  const adminAccess = isDesignatedAdminEmail(session?.email);

  return (
    <>
      <TrialAccessMonitor />
      <DashboardApp />
      <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 80, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {adminAccess && <Link href="/ai-governance" className="btn" style={{ boxShadow: "0 14px 36px rgba(0,0,0,.28)" }}>AI Governance</Link>}
        <Link href="/passkeys" className="btn" style={{ boxShadow: "0 14px 36px rgba(0,0,0,.28)" }}>Passkeys</Link>
        <Link href="/security-center" className="btn gold" style={{ boxShadow: "0 14px 36px rgba(0,0,0,.28)" }}>Security Center</Link>
      </div>
    </>
  );
}
