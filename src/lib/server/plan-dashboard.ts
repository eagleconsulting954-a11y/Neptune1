import { canAccessResource, planDefinition } from "@/src/lib/plans";

export type DashboardRecord = Record<string, any>;

function openStatus(value: unknown) {
  return !["closed", "complete", "completed", "resolved", "cancelled", "canceled"].includes(String(value || "").toLowerCase());
}

export function filterDashboardForPlan(data: DashboardRecord, plan: string): DashboardRecord {
  const filtered: DashboardRecord = {
    ...data,
    vessels: canAccessResource(plan, "vessels") ? data.vessels || [] : [],
    duties: canAccessResource(plan, "duties") ? data.duties || [] : [],
    workOrders: canAccessResource(plan, "work_orders") ? data.workOrders || [] : [],
    certificates: canAccessResource(plan, "certificates") ? data.certificates || [] : [],
    incidents: canAccessResource(plan, "incidents") ? data.incidents || [] : [],
    crm: canAccessResource(plan, "crm_accounts") ? data.crm || [] : [],
    events: canAccessResource(plan, "activity_events") ? data.events || [] : [],
    subscriptions: canAccessResource(plan, "subscriptions") ? data.subscriptions || [] : [],
    ports: canAccessResource(plan, "ports") ? data.ports || [] : [],
    bunkerPlans: canAccessResource(plan, "bunker_plans") ? data.bunkerPlans || [] : [],
    mrccContacts: canAccessResource(plan, "mrcc_contacts") ? data.mrccContacts || [] : [],
    congestionSnapshots: canAccessResource(plan, "port_congestion_snapshots") ? data.congestionSnapshots || [] : []
  };

  filtered.kpis = recalculatePlanKpis(filtered);
  filtered.package = {
    key: planDefinition(plan).key,
    name: planDefinition(plan).name,
    modules: planDefinition(plan).modules,
    limits: planDefinition(plan).limits
  };
  return filtered;
}

export function recalculatePlanKpis(data: DashboardRecord) {
  const vessels = data.vessels || [];
  const duties = data.duties || [];
  const workOrders = data.workOrders || [];
  const certificates = data.certificates || [];
  const incidents = data.incidents || [];
  const crm = data.crm || [];
  const ports = data.ports || [];
  const bunkerPlans = data.bunkerPlans || [];
  const mrccContacts = data.mrccContacts || [];
  const readiness = vessels.length
    ? Math.round(vessels.reduce((total: number, vessel: any) => total + Number(vessel.readiness || 0), 0) / vessels.length)
    : 0;
  const expiringCertificates = certificates.filter((item: any) => {
    const explicit = String(item.status || "").toLowerCase().includes("expir");
    const date = item.expires_at ? new Date(String(item.expires_at)) : null;
    const days = date && !Number.isNaN(date.getTime()) ? Math.ceil((date.getTime() - Date.now()) / 86_400_000) : null;
    return explicit || (days !== null && days <= 45);
  }).length;
  const criticalDuties = duties.filter((item: any) => openStatus(item.status) && String(item.severity || "").toLowerCase() === "critical").length;
  const criticalIncidents = incidents.filter((item: any) => openStatus(item.status) && ["critical", "high", "major"].includes(String(item.severity || "").toLowerCase())).length;

  return {
    vessels: vessels.length,
    openDuties: duties.filter((item: any) => openStatus(item.status)).length,
    critical: criticalDuties + criticalIncidents,
    readiness,
    openWorkOrders: workOrders.filter((item: any) => openStatus(item.status)).length,
    expiringCertificates,
    openIncidents: incidents.filter((item: any) => openStatus(item.status)).length,
    pipeline: crm.reduce((total: number, item: any) => total + Number(item.annual_value || 0), 0),
    ports: ports.length,
    bunkerPlans: bunkerPlans.length,
    verifiedMrcc: mrccContacts.filter((item: any) => Boolean(item.verified_at)).length
  };
}
