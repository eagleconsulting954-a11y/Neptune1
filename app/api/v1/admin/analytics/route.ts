import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { dashboard, type Row } from "@/src/lib/server/db";
import { canAccessModule } from "@/src/lib/plans";
import { filterDashboardForPlan } from "@/src/lib/server/plan-dashboard";
import { isDesignatedAdminEmail } from "@/src/lib/server/admin-access";
import { CRM_STAGES, buildCrmAnalytics, listAdminAudit, listCrmAccounts } from "@/src/lib/server/crm-admin";

function monthKey(value: string | Date) {
  const date = new Date(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function recentMonths(count = 6) {
  const months: { key: string; label: string }[] = [];
  const today = new Date();
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1));
    months.push({ key: monthKey(date), label: date.toLocaleString("en-US", { month: "short", timeZone: "UTC" }) });
  }
  return months;
}

function metadata(row: Row) {
  return row.metadata && typeof row.metadata === "object" ? row.metadata : {};
}

function companyFromAudit(row: Row, crmById: Map<string, Row>) {
  const meta = metadata(row) as any;
  return meta.after?.company || meta.before?.company || crmById.get(String(row.entity_id || ""))?.company || "CRM opportunity";
}

function auditPresentation(row: Row, crmById: Map<string, Row>) {
  const action = String(row.action || "activity");
  const meta = metadata(row) as any;
  const company = companyFromAudit(row, crmById);
  if (action === "crm.opportunity_created" || action === "crm_accounts.created") {
    return { label: "Opportunity created", body: `${company} was added to the CRM pipeline.` };
  }
  if (action === "crm.stage_changed") {
    const before = meta.before?.stage || "previous stage";
    const after = meta.after?.stage || "new stage";
    return { label: "Pipeline stage changed", body: `${company} moved from ${before} to ${after}.` };
  }
  if (action === "crm.opportunity_updated" || action === "crm_accounts.updated") {
    const changed = Array.isArray(meta.changedFields) ? meta.changedFields.filter((field: string) => !["updated_at","stage_changed_at"].includes(field)) : [];
    return { label: "Opportunity updated", body: changed.length ? `${company}: ${changed.join(", ")} updated.` : `${company} was updated.` };
  }
  if (action === "crm.opportunity_deleted" || action === "crm_accounts.deleted") {
    return { label: "Opportunity deleted", body: `${company} was removed from the active CRM dataset.` };
  }
  if (action.startsWith("auth.")) return { label: "Identity activity", body: action.replaceAll(".", " ") };
  if (action.startsWith("platform.")) return { label: "Platform administration", body: action.replaceAll(".", " ") };
  return { label: action.replaceAll("_", " ").replaceAll(".", " · "), body: row.entity_type ? `${row.entity_type}${row.entity_id ? ` · ${row.entity_id}` : ""}` : "Neptune administrative event." };
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!isDesignatedAdminEmail(session.email)) {
      return NextResponse.json({ error: "CRM and administrator access is restricted to the two designated Neptune administrator emails." }, { status: 403 });
    }

    const [raw, crm, audit] = await Promise.all([
      dashboard(session.orgId),
      listCrmAccounts(session.orgId),
      listAdminAudit(session.orgId, 30)
    ]);
    const data = filterDashboardForPlan(raw, session.entitlement.plan);
    const crmAnalytics = buildCrmAnalytics(crm);
    const crmById = new Map(crm.map(account => [String(account.id), account]));

    const trend = recentMonths().map(month => ({
      month: month.label,
      pipeline: crm
        .filter(account => account.created_at && monthKey(account.created_at) === month.key)
        .reduce((sum, account) => sum + Number(account.annual_value || 0), 0),
      won: crm
        .filter(account => String(account.stage || "").toLowerCase() === "won" && account.stage_changed_at && monthKey(account.stage_changed_at) === month.key)
        .reduce((sum, account) => sum + Number(account.annual_value || 0), 0),
      activity: audit.filter(event => event.created_at && monthKey(event.created_at) === month.key).length
    }));

    const operational = [
      { module: "vessels", label: "Fleet readiness", value: data.kpis.readiness, suffix: "%" },
      { module: "delegation", label: "Open duties", value: data.kpis.openDuties, suffix: "" },
      { module: "maintenance", label: "Work orders", value: data.kpis.openWorkOrders, suffix: "" },
      { module: "certificates", label: "Expiring certificates", value: data.kpis.expiringCertificates, suffix: "" },
      { module: "incidents", label: "Open incidents", value: data.kpis.openIncidents, suffix: "" }
    ].filter(item => canAccessModule(session.entitlement.plan, item.module as any));

    return NextResponse.json({
      storageMode: data.storageMode,
      organization: { id: session.orgId, role: session.role, email: session.email, plan: session.entitlement.planName },
      package: { ...data.package, modules: Array.from(new Set([...(data.package?.modules || []), "crm", "analytics"])) },
      pipelineStages: CRM_STAGES,
      summary: {
        ...crmAnalytics.summary,
        fleetReadiness: data.kpis.readiness,
        openDuties: canAccessModule(session.entitlement.plan, "delegation") ? data.kpis.openDuties : null,
        criticalItems: data.kpis.critical
      },
      stages: crmAnalytics.stages,
      owners: crmAnalytics.owners,
      sources: crmAnalytics.sources,
      forecast: crmAnalytics.forecast,
      alerts: crmAnalytics.alerts,
      crm,
      operational,
      trend,
      recentActivity: audit.map(event => ({
        id: event.id,
        ...auditPresentation(event, crmById),
        actor: event.user_email || "Neptune system",
        action: event.action,
        created_at: event.created_at
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "TRIAL_EXPIRED") return NextResponse.json({ error: "Your 14-day trial has ended.", code: "TRIAL_EXPIRED" }, { status: 402 });
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required.", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
    console.error(error);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
