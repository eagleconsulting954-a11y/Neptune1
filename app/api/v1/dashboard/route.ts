import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { dashboard } from "@/src/lib/server/db";
import { buildDecisionInsights } from "@/src/lib/server/decision-insights";
import { filterDashboardForPlan, recalculatePlanKpis } from "@/src/lib/server/plan-dashboard";
import { isDesignatedAdminEmail } from "@/src/lib/server/admin-access";
import { canManageOrganization, scopeDashboardForSession } from "@/src/lib/server/org-access";

function scopedDecisionInsights(data: Record<string, any>) {
  const openIncidents = (data.incidents || []).filter((item: any) => !["closed", "resolved"].includes(String(item.status || "").toLowerCase()));
  const severeIncidents = openIncidents.filter((item: any) => ["high", "critical"].includes(String(item.severity || "").toLowerCase()));
  const criticalDuties = (data.duties || []).filter((item: any) => String(item.severity || "").toLowerCase() === "critical" && !["closed", "completed", "complete"].includes(String(item.status || "").toLowerCase()));
  const criticalWork = (data.workOrders || []).filter((item: any) => String(item.priority || "").toLowerCase() === "critical" && !["closed", "completed", "complete"].includes(String(item.status || "").toLowerCase()));
  const certificateAlerts = Number(data.kpis?.expiringCertificates || 0);
  const alerts: any[] = [];

  if (severeIncidents.length) alerts.push({ id: "scoped-incidents", severity: "critical", module: "Incidents", title: "Severe incident workload", detail: "Assigned-vessel incident records include high or critical open conditions.", count: severeIncidents.length });
  if (criticalDuties.length) alerts.push({ id: "scoped-duties", severity: "critical", module: "Delegation", title: "Critical assigned duties", detail: "Critical duties remain open on vessels included in your access scope.", count: criticalDuties.length });
  if (criticalWork.length) alerts.push({ id: "scoped-work", severity: "warning", module: "Maintenance", title: "Critical maintenance priority", detail: "Critical-priority work remains open on vessels included in your access scope.", count: criticalWork.length });
  if (certificateAlerts) alerts.push({ id: "scoped-certificates", severity: "warning", module: "Certificates", title: "Certificate attention window", detail: "Assigned-vessel certificate records contain expired or near-term compliance windows.", count: certificateAlerts });

  const recommendations = alerts.slice(0, 4).map((alert: any, index: number) => ({
    id: `scoped-rec-${index + 1}`,
    priority: alert.severity === "critical" ? "High" : "Medium",
    module: alert.module,
    title: `Review ${alert.module.toLowerCase()} evidence and ownership`,
    rationale: alert.detail,
    action: `Open ${alert.module} and confirm owner, status, deadline, and closeout evidence.`,
    signal: String(alert.count)
  }));

  const readiness = Number(data.kpis?.readiness || 0);
  const riskPenalty = Math.min(45, severeIncidents.length * 12 + criticalDuties.length * 8 + criticalWork.length * 5 + certificateAlerts * 4);
  const score = Math.max(0, Math.min(100, Math.round(readiness - riskPenalty)));
  const outlook = score < 50 || severeIncidents.length ? "Critical" : score < 75 || alerts.length ? "Watch" : "Stable";

  return {
    generatedAt: new Date().toISOString(),
    score,
    outlook,
    summary: alerts.length ? `${alerts.length} assigned-vessel risk categories require review.` : "No critical conditions are visible in your assigned-vessel records.",
    methodology: "Scope-limited decision view based only on vessels assigned to this identity. Fleet-wide activity, billing, and historical trend snapshots are restricted to organization managers.",
    alerts,
    recommendations,
    trend: {
      points: [],
      readinessChange: null,
      baselineStatus: "Historical fleet-wide trend is hidden for vessel-scoped identities."
    }
  };
}

export async function GET() {
  try {
    const session = await requireSession();
    const adminAccess = isDesignatedAdminEmail(session.email);
    const managerAccess = canManageOrganization(session);
    const raw = await dashboard(session.orgId);
    const scoped = await scopeDashboardForSession(session, raw);
    const data = filterDashboardForPlan(scoped, session.entitlement.plan);

    if (!managerAccess) {
      data.events = [];
      data.subscriptions = [];
      data.kpis = recalculatePlanKpis(data);
    }

    if (adminAccess) {
      data.crm = raw.crm || [];
      data.kpis = recalculatePlanKpis(data);
      data.package = {
        ...data.package,
        modules: Array.from(new Set([...(data.package?.modules || []), "crm", "analytics"]))
      };
    } else {
      data.crm = [];
      data.kpis = recalculatePlanKpis(data);
      data.package = {
        ...data.package,
        modules: (data.package?.modules || []).filter((module: string) => !["crm", "analytics"].includes(module))
      };
    }

    const roleRestrictedModules = managerAccess ? [] : ["activity", "billing"];
    const entitlement = {
      ...session.entitlement,
      access: {
        ...session.entitlement.access,
        modules: adminAccess
          ? Array.from(new Set([...session.entitlement.access.modules, "crm", "analytics"]))
          : session.entitlement.access.modules.filter(module => !["crm", "analytics", ...roleRestrictedModules].includes(module))
      }
    };
    const insights = managerAccess
      ? await buildDecisionInsights(session.orgId, data as any)
      : scopedDecisionInsights(data as any);
    return NextResponse.json({ ...data, insights, entitlement, adminAccess, managerAccess });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "TRIAL_EXPIRED") return NextResponse.json({ error: "Your 14-day trial has ended.", code: "TRIAL_EXPIRED" }, { status: 402 });
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required.", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
    if (message === "DATABASE_REQUIRED") return NextResponse.json({ error: "Production database is not configured." }, { status: 503 });
    console.error(error);
    return NextResponse.json({ error: "Unable to load the decision dashboard." }, { status: 500 });
  }
}
