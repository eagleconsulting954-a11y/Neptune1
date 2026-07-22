import { redirect } from "next/navigation";
import { PlatformAdminDashboard } from "@/components/PlatformAdminDashboard";
import { getSession } from "@/src/lib/server/auth";
import { isDesignatedAdminEmail } from "@/src/lib/server/admin-access";

export default async function PlatformAdminPage() {
  const session = await getSession();
  if (!session) redirect("/login?from=/platform-admin");
  if (!isDesignatedAdminEmail(session.email)) redirect("/dashboard");
  return <PlatformAdminDashboard />;
}
