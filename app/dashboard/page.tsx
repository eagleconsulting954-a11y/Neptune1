import Link from "next/link";
import { DashboardApp } from "@/components/DashboardApp";

export default function DashboardPage() {
  return (
    <>
      <DashboardApp />
      <Link className="dashboard-admin-link" href="/admin">CRM & Analytics Admin</Link>
    </>
  );
}
