import { sql, type Row } from "@/src/lib/server/db";

type DashboardInput = {
  kpis: Record<string, number>;
  vessels: Row[];
  duties: Row[];
  workOrders: Row[];
  certificates: Row[];
  incidents: Row[];
  ports: Row[];
  congestionSnapshots: Row[];
};

type InsightAlert = {
  id: string;
  severity: "critical" | "warning" | "watch";
  title: string;
  detail: string;
  module: string;
  count: number;
};

type Recommendation = {
  id: string;
  priority: "Immediate" | "High" | "Planned";
  title: string;
  rationale: string;
  action: string;
  module: string;
  signal: string;
};

function normalized(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isOpen(value: unknown) {
  return !["closed", "complete", "completed", "resolved", "cancelled", "canceled"].includes(normalized(value));
}

function dateValue(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysFromNow(value: unknown) {
  const date = dateValue(value);
  if (!date) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

async function ensureInsightSchema() {
  await sql(`
    create table if not exists fleet_health_snapshots (
      id text primary key,
      org_id text not null references organizations(id) on delete cascade,
      snapshot_date date not null,
      readiness int not null default 0,
      vessels int not null default 0,
      open_duties int not null default 0,
      critical_items int not null default 0,
      open_work_orders int not null default 0,
      expiring_certificates int not null default 0,
      open_incidents int not null default 0,
      created_at timestamptz not null default now(),
      unique(org_id,snapshot_date)
    );
    create index if not exists idx_fleet_health_org_date on fleet_health_snapshots(org_id,snapshot_date desc);
  `);
}

async function persistSnapshot(orgId: string, kpis: Record<string, number>) {
  await ensureInsightSchema();
  await sql(`
    insert into fleet_health_snapshots(
      id,org_id,snapshot_date,readiness,vessels,open_duties,critical_items,open_work_orders,expiring_certificates,open_incidents
    ) values($1,$2,current_date,$3,$4,$5,$6,$7,$8,$9)
    on conflict(org_id,snapshot_date) do update set
      readiness=excluded.readiness,
      vessels=excluded.vessels,
      open_duties=excluded.open_duties,
      critical_items=excluded.critical_items,
      open_work_orders=excluded.open_work_orders,
      expiring_certificates=excluded.expiring_certificates,
      open_incidents=excluded.open_incidents
  `, [
    `health_${orgId}_${new Date().toISOString().slice(0, 10)}`,
    orgId,
    Number(kpis.readiness || 0),
    Number(kpis.vessels || 0),
    Number(kpis.openDuties || 0),
    Number(kpis.critical || 0),
    Number(kpis.openWorkOrders || 0),
    Number(kpis.expiringCertificates || 0),
    Number(kpis.openIncidents || 0)
  ]);
}

function buildAlerts(data: DashboardInput): InsightAlert[] {
  const alerts: InsightAlert[] = [];
  const criticalDuties = data.duties.filter(item => isOpen(item.status) && normalized(item.severity) === "critical");
  const urgentWork = data.workOrders.filter(item => isOpen(item.status) && ["critical", "urgent", "high"].includes(normalized(item.priority)));
  const severeIncidents = data.incidents.filter(item => isOpen(item.status) && ["critical", "high", "major"].includes(normalized(item.severity)));
  const expiringCertificates = data.certificates.filter(item => {
    const days = daysFromNow(item.expires_at);
    return normalized(item.status).includes("expir") || (days !== null && days >= 0 && days <= 45);
  });
  const expiredCertificates = data.certificates.filter(item => {
    const days = daysFromNow(item.expires_at);
    return days !== null && days < 0;
  });
  const lowReadiness = data.vessels.filter(item => Number(item.readiness || 0) > 0 && Number(item.readiness || 0) < 75);
  const latestCongestion = new Map<string, Row>();
  for (const snapshot of data.congestionSnapshots) {
    const key = String(snapshot.port_id || snapshot.id);
    if (!latestCongestion.has(key)) latestCongestion.set(key, snapshot);
  }
  const congestedPorts = Array.from(latestCongestion.values()).filter(item => ["high", "critical", "severe"].includes(normalized(item.congestion_level)));

  if (criticalDuties.length) alerts.push({ id: "critical-duties", severity: "critical", title: "Critical duties require command attention", detail: `${criticalDuties.length} open critical assignment${criticalDuties.length === 1 ? "" : "s"} should be confirmed, owned, and closed.`, module: "Delegation", count: criticalDuties.length });
  if (expiredCertificates.length) alerts.push({ id: "expired-certificates", severity: "critical", title: "Expired certificate exposure", detail: `${expiredCertificates.length} certificate${expiredCertificates.length === 1 ? " is" : "s are"} past the recorded expiry date.`, module: "Certificates", count: expiredCertificates.length });
  if (severeIncidents.length) alerts.push({ id: "severe-incidents", severity: "critical", title: "High-severity incidents remain open", detail: `${severeIncidents.length} incident${severeIncidents.length === 1 ? " needs" : "s need"} RCA and corrective-action review.`, module: "Incidents", count: severeIncidents.length });
  if (urgentWork.length) alerts.push({ id: "urgent-work", severity: "warning", title: "Priority maintenance queue is building", detail: `${urgentWork.length} high-priority work order${urgentWork.length === 1 ? " is" : "s are"} still open.`, module: "Maintenance", count: urgentWork.length });
  if (expiringCertificates.length) alerts.push({ id: "expiring-certificates", severity: "warning", title: "Certificate renewal window approaching", detail: `${expiringCertificates.length} certificate${expiringCertificates.length === 1 ? " is" : "s are"} expiring or inside the next 45 days.`, module: "Certificates", count: expiringCertificates.length });
  if (lowReadiness.length) alerts.push({ id: "low-readiness", severity: "warning", title: "Vessels below readiness target", detail: `${lowReadiness.length} vessel${lowReadiness.length === 1 ? " is" : "s are"} below the 75% readiness threshold.`, module: "Vessels", count: lowReadiness.length });
  if (congestedPorts.length) alerts.push({ id: "port-congestion", severity: "watch", title: "High port congestion signal", detail: `${congestedPorts.length} monitored port${congestedPorts.length === 1 ? " has" : "s have"} a high or critical latest congestion reading.`, module: "Maritime Intel", count: congestedPorts.length });

  const severityOrder: Record<InsightAlert["severity"], number> = { critical: 0, warning: 1, watch: 2 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

function buildRecommendations(data: DashboardInput, alerts: InsightAlert[]): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const readiness = Number(data.kpis.readiness || 0);
  const vesselsWithReadiness = data.vessels.filter(item => Number(item.readiness || 0) > 0).length;
  const vesselsMissingCoreData = data.vessels.filter(item => !item.imo || !item.status || Number(item.readiness || 0) <= 0).length;
  const alert = (id: string) => alerts.find(item => item.id === id);

  if (alert("expired-certificates")) recommendations.push({ id: "renew-expired", priority: "Immediate", title: "Resolve expired certificate records before the next operational commitment", rationale: "Expired records create a direct compliance and voyage-readiness risk.", action: "Verify validity, upload renewed evidence, and update status.", module: "Certificates", signal: `${alert("expired-certificates")?.count} expired` });
  if (alert("critical-duties")) recommendations.push({ id: "close-critical-duties", priority: "Immediate", title: "Run a command review of every critical delegated duty", rationale: "Open critical assignments indicate unresolved operational control points.", action: "Confirm owner, due time, evidence, and master approval.", module: "Delegation", signal: `${alert("critical-duties")?.count} critical` });
  if (alert("severe-incidents")) recommendations.push({ id: "incident-risks", priority: "Immediate", title: "Escalate severe incident corrective actions", rationale: "Unclosed high-severity incidents can repeat when root causes and controls remain incomplete.", action: "Review RCA owner, corrective actions, and verification dates.", module: "Incidents", signal: `${alert("severe-incidents")?.count} severe` });
  if (readiness > 0 && readiness < 80) recommendations.push({ id: "readiness-recovery", priority: "High", title: "Build a readiness recovery plan for the lowest-scoring vessels", rationale: `Recorded average readiness is ${readiness}%, below the 80% decision threshold.`, action: "Rank vessel gaps by certificate, maintenance, duty, and incident exposure.", module: "Vessels", signal: `${readiness}% readiness` });
  if (alert("urgent-work")) recommendations.push({ id: "maintenance-priority", priority: "High", title: "Protect the maintenance window for priority work orders", rationale: "High-priority engineering work can reduce availability and increase downstream schedule risk.", action: "Confirm parts, owner, due date, and operational impact.", module: "Maintenance", signal: `${alert("urgent-work")?.count} priority` });
  if (alert("expiring-certificates")) recommendations.push({ id: "renewal-plan", priority: "High", title: "Bundle the next certificate renewals into one controlled plan", rationale: "A 45-day renewal window gives the team time to coordinate surveys, evidence, and authority submissions.", action: "Assign renewal owners and planned completion dates.", module: "Certificates", signal: `${alert("expiring-certificates")?.count} approaching` });
  if (alert("port-congestion")) recommendations.push({ id: "congestion-plan", priority: "Planned", title: "Review arrival and bunkering timing against the latest congestion signal", rationale: "High congestion can affect berth windows, fuel plans, and onward schedule reliability.", action: "Compare alternate arrival, anchorage, terminal, and bunker scenarios.", module: "Maritime Intel", signal: `${alert("port-congestion")?.count} port signal` });
  if (vesselsMissingCoreData) recommendations.push({ id: "data-quality", priority: "Planned", title: "Complete vessel data to improve decision confidence", rationale: `${vesselsMissingCoreData} vessel record${vesselsMissingCoreData === 1 ? " is" : "s are"} missing IMO, status, or readiness information.`, action: "Complete the core vessel profile so alerts and fleet scoring use reliable inputs.", module: "Vessels", signal: `${vesselsMissingCoreData} incomplete` });
  if (data.vessels.length && vesselsWithReadiness === 0) recommendations.push({ id: "readiness-baseline", priority: "Planned", title: "Establish the first fleet-readiness baseline", rationale: "No vessel currently has a positive readiness score, so trend and outlook confidence are limited.", action: "Assess each vessel and enter a current readiness percentage.", module: "Vessels", signal: "Baseline needed" });

  return recommendations.slice(0, 6);
}

function operationalScore(data: DashboardInput, alerts: InsightAlert[]) {
  if (!data.vessels.length) return 0;
  const readiness = Number(data.kpis.readiness || 0);
  const criticalCount = alerts.filter(item => item.severity === "critical").reduce((total, item) => total + item.count, 0);
  const warningCount = alerts.filter(item => item.severity === "warning").reduce((total, item) => total + item.count, 0);
  const dataCoverage = Math.round(data.vessels.filter(item => item.imo && item.status && Number(item.readiness || 0) > 0).length / data.vessels.length * 100);
  return Math.max(0, Math.min(100, Math.round(readiness * .65 + dataCoverage * .35 - criticalCount * 7 - warningCount * 2)));
}

function snapshotDate(value: unknown) {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}

export async function buildDecisionInsights(orgId: string, data: DashboardInput) {
  await persistSnapshot(orgId, data.kpis);
  const trendRows = await sql<Row>(`
    select snapshot_date,readiness,vessels,open_duties,critical_items,open_work_orders,expiring_certificates,open_incidents
    from fleet_health_snapshots
    where org_id=$1 and snapshot_date >= current_date - interval '29 days'
    order by snapshot_date
  `, [orgId]);

  const alerts = buildAlerts(data);
  const recommendations = buildRecommendations(data, alerts);
  const score = operationalScore(data, alerts);
  const criticalCount = alerts.filter(item => item.severity === "critical").reduce((total, item) => total + item.count, 0);
  const warningCount = alerts.filter(item => item.severity === "warning").reduce((total, item) => total + item.count, 0);
  const outlook = !data.vessels.length ? "Awaiting data" : criticalCount ? "At risk" : warningCount ? "Watch" : score >= 85 ? "Strong" : "Stable";
  const latest = trendRows.length ? trendRows[trendRows.length - 1] : null;
  const previous = trendRows.length > 1 ? trendRows[trendRows.length - 2] : null;

  return {
    score,
    outlook,
    summary: !data.vessels.length
      ? "Add vessel and operational records to generate a real fleet outlook."
      : criticalCount
        ? "Immediate command attention is required on the highest-risk open items."
        : warningCount
          ? "The fleet is operating with manageable risks that should be planned and assigned."
          : "No critical operational signals are currently present in the recorded data.",
    alerts,
    recommendations,
    trend: {
      points: trendRows.map(row => ({
        date: snapshotDate(row.snapshot_date),
        readiness: Number(row.readiness || 0),
        riskLoad: Number(row.critical_items || 0) + Number(row.open_incidents || 0) + Number(row.expiring_certificates || 0),
        openWork: Number(row.open_duties || 0) + Number(row.open_work_orders || 0)
      })),
      readinessChange: latest && previous ? Number(latest.readiness || 0) - Number(previous.readiness || 0) : null,
      riskChange: latest && previous
        ? (Number(latest.critical_items || 0) + Number(latest.open_incidents || 0) + Number(latest.expiring_certificates || 0)) - (Number(previous.critical_items || 0) + Number(previous.open_incidents || 0) + Number(previous.expiring_certificates || 0))
        : null,
      baselineStatus: trendRows.length < 2 ? "Baseline created. Neptune will build the real trend as daily snapshots accumulate." : `${trendRows.length} daily fleet snapshots recorded.`
    },
    generatedAt: new Date().toISOString(),
    methodology: "Deterministic analysis of organization-entered vessel, duty, maintenance, certificate, incident, port, and congestion records."
  };
}
