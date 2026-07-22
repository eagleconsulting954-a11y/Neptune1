import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { dashboard } from "@/src/lib/server/db";
import { buildDecisionInsights } from "@/src/lib/server/decision-insights";
import { filterDashboardForPlan, recalculatePlanKpis } from "@/src/lib/server/plan-dashboard";
import { isDesignatedAdminEmail } from "@/src/lib/server/admin-access";

export async function GET() {
  try {
    const session = await requireSession();
    const adminAccess = isDesignatedAdminEmail(session.email);
    const raw = await dashboard(session.orgId);
    const data = filterDashboardForPlan(raw, session.entitlement.plan);

    if (!adminAccess) {
      data.crm = [];
      data.kpis = recalculatePlanKpis(data);
      data.package = {
        ...data.package,
        modules: (data.package?.modules || []).filter((module: string) => !["crm", "analytics"].includes(module))
      };
    }

    const entitlement = adminAccess ? session.entitlement : {
      ...session.entitlement,
      access: {
        ...session.entitlement.access,
        modules: session.entitlement.access.modules.filter(module => !["crm", "analytics"].includes(module))
      }
    };
    const insights = await buildDecisionInsights(session.orgId, data as any);
    return NextResponse.json({ ...data, insights, entitlement, adminAccess });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "TRIAL_EXPIRED") return NextResponse.json({ error: "Your 14-day trial has ended.", code: "TRIAL_EXPIRED" }, { status: 402 });
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required.", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
    if (message === "DATABASE_REQUIRED") return NextResponse.json({ error: "Production database is not configured." }, { status: 503 });
    console.error(error);
    return NextResponse.json({ error: "Unable to load the decision dashboard." }, { status: 500 });
  }
}
