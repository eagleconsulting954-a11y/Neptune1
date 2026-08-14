import { redirect } from "next/navigation";
import { PlatformAdminDashboard } from "@/components/PlatformAdminDashboard";
import { SecondaryAdminProvision } from "@/components/SecondaryAdminProvision";
import { getSession } from "@/src/lib/server/auth";
import { designatedAdminEmail, isDesignatedAdminEmail } from "@/src/lib/server/admin-access";

export default async function PlatformAdminPage() {
  const session = await getSession();
  if (!session) redirect("/login?from=/platform-admin");
  if (!isDesignatedAdminEmail(session.email)) redirect("/dashboard");
  return <>{String(session.email || "").toLowerCase() === designatedAdminEmail() && <SecondaryAdminProvision />}<PlatformAdminDashboard /></>;
}
