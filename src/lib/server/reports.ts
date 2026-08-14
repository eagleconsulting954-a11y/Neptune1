import { createHash, randomUUID } from "crypto";
import type { Session } from "@/src/lib/server/auth";
import { dashboard, type Row } from "@/src/lib/server/db";
import { listEmergencyEvents, listEmergencyPositions } from "@/src/lib/server/emergency-db";
import { canManageOrganization, getOrganizationAudit, getOrganizationProfile, scopeDashboardForSession } from "@/src/lib/server/org-access";

export type ReportType = "fleet_summary" | "vessel_readiness" | "certificates" | "maintenance" | "incidents" | "emergency_gps" | "audit";

const REPORT_TYPES = new Set<ReportType>(["fleet_summary", "vessel_readiness", "certificates", "maintenance", "incidents", "emergency_gps", "audit"]);

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

function evidenceHash(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function cleanRows(rows: Row[]) {
  return rows.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => !["org_id", "password_hash", "mfa_secret_enc"].includes(key))));
}

export function normalizeReportType(value: unknown): ReportType {
  const type = String(value || "fleet_summary").trim().toLowerCase() as ReportType;
  if (!REPORT_TYPES.has(type)) throw new Error("REPORT_TYPE_INVALID");
  return type;
}

export async function buildReport(session: Pick<Session, "userId" | "orgId" | "role" | "email">, type: ReportType, eventId?: string | null) {
  const generatedAt = new Date().toISOString();
  const organization = await getOrganizationProfile(session.orgId);
  const raw = await dashboard(session.orgId);
  const scoped = await scopeDashboardForSession(session, raw);
  let rows: Row[] = [];
  let title = "Neptune Enterprise Report";
  let summary: Record<string, unknown> = {};

  if (type === "fleet_summary") {
    if (!canManageOrganization(session)) throw new Error("REPORT_MANAGER_REQUIRED");
    rows = cleanRows(scoped.vessels || []);
    title = "Fleet Executive Summary";
    summary = {
      vessels: rows.length,
      readiness: scoped.kpis?.readiness || 0,
      openDuties: scoped.kpis?.openDuties || 0,
      openWorkOrders: scoped.kpis?.openWorkOrders || 0,
      certificateAlerts: scoped.kpis?.expiringCertificates || 0,
      openIncidents: scoped.kpis?.openIncidents || 0
    };
  } else if (type === "vessel_readiness") {
    rows = cleanRows(scoped.vessels || []);
    title = "Vessel Readiness Report";
    summary = { vessels: rows.length, averageReadiness: scoped.kpis?.readiness || 0 };
  } else if (type === "certificates") {
    rows = cleanRows(scoped.certificates || []);
    title = "Certificate Evidence Report";
    summary = { records: rows.length, alerts: scoped.kpis?.expiringCertificates || 0 };
  } else if (type === "maintenance") {
    rows = cleanRows(scoped.workOrders || []);
    title = "Maintenance & Work Order Report";
    summary = { records: rows.length, open: scoped.kpis?.openWorkOrders || 0 };
  } else if (type === "incidents") {
    rows = cleanRows(scoped.incidents || []);
    title = "Incident & Corrective Action Report";
    summary = { records: rows.length, open: scoped.kpis?.openIncidents || 0 };
  } else if (type === "audit") {
    if (!canManageOrganization(session)) throw new Error("REPORT_MANAGER_REQUIRED");
    rows = cleanRows(await getOrganizationAudit(session.orgId, 500));
    title = "Immutable Audit Evidence Report";
    summary = { events: rows.length };
  } else if (type === "emergency_gps") {
    const events = await listEmergencyEvents(session.orgId, 100);
    const allowedEvents = await (async () => {
      const scopedVessels = new Set((scoped.vessels || []).map((item: Row) => String(item.id)));
      return canManageOrganization(session) ? events : events.filter((item: Row) => item.vessel_id && scopedVessels.has(String(item.vessel_id)));
    })();
    const selected = eventId ? allowedEvents.find((item: Row) => String(item.id) === eventId) : allowedEvents[0];
    if (!selected) {
      rows = [];
      summary = { event: null, positions: 0 };
    } else {
      const positions = await listEmergencyPositions(session.orgId, String(selected.id), 5000);
      rows = cleanRows(positions);
      summary = {
        eventId: selected.id,
        vesselId: selected.vessel_id,
        status: selected.status,
        startedAt: selected.started_at,
        endedAt: selected.ended_at,
        positions: rows.length
      };
    }
    title = "Emergency GPS Chronology";
  }

  const payload = {
    reportId: `report_${randomUUID()}`,
    type,
    title,
    generatedAt,
    organization: { id: session.orgId, name: organization?.name || "Neptune organization" },
    generatedBy: session.email || session.userId,
    summary,
    rows
  };
  return { ...payload, evidenceHash: evidenceHash(payload) };
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function reportCsv(report: Awaited<ReturnType<typeof buildReport>>) {
  const metadata = [
    ["Report ID", report.reportId],
    ["Title", report.title],
    ["Organization", report.organization.name],
    ["Generated at", report.generatedAt],
    ["Generated by", report.generatedBy],
    ["Evidence SHA-256", report.evidenceHash]
  ].map(row => row.map(csvCell).join(",")).join("\n");
  if (!report.rows.length) return `${metadata}\n\n"No records"\n`;
  const columns = Array.from(new Set(report.rows.flatMap(row => Object.keys(row))));
  const body = [columns.map(csvCell).join(","), ...report.rows.map(row => columns.map(column => csvCell(row[column])).join(","))].join("\n");
  return `${metadata}\n\n${body}\n`;
}

function htmlEscape(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}

export function reportHtml(report: Awaited<ReturnType<typeof buildReport>>) {
  const columns = report.rows.length ? Array.from(new Set(report.rows.flatMap(row => Object.keys(row)))) : [];
  const summary = Object.entries(report.summary).map(([key, value]) => `<div><span>${htmlEscape(key.replaceAll("_", " "))}</span><b>${htmlEscape(typeof value === "object" ? JSON.stringify(value) : value)}</b></div>`).join("");
  const table = columns.length ? `<table><thead><tr>${columns.map(column => `<th>${htmlEscape(column.replaceAll("_", " "))}</th>`).join("")}</tr></thead><tbody>${report.rows.map(row => `<tr>${columns.map(column => `<td>${htmlEscape(typeof row[column] === "object" ? JSON.stringify(row[column]) : row[column])}</td>`).join("")}</tr>`).join("")}</tbody></table>` : `<p>No records matched this report.</p>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${htmlEscape(report.title)}</title><style>body{font-family:Arial,sans-serif;color:#12202d;margin:32px}header{border-bottom:2px solid #12202d;padding-bottom:16px;margin-bottom:20px}.meta{font-size:12px;color:#526272;line-height:1.6}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:20px 0}.summary div{border:1px solid #cfd7df;border-radius:8px;padding:10px}.summary span{display:block;font-size:11px;text-transform:uppercase;color:#637384}.summary b{display:block;margin-top:4px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #d8dee5;padding:6px;vertical-align:top;text-align:left}th{background:#eef2f5}.hash{font-family:monospace;overflow-wrap:anywhere}.controls{margin-bottom:18px}@media print{.controls{display:none}body{margin:12mm}}</style></head><body><div class="controls"><button onclick="window.print()">Print / Save as PDF</button></div><header><h1>${htmlEscape(report.title)}</h1><div class="meta">Organization: ${htmlEscape(report.organization.name)}<br>Report ID: ${htmlEscape(report.reportId)}<br>Generated: ${htmlEscape(report.generatedAt)}<br>Generated by: ${htmlEscape(report.generatedBy)}<br>Evidence SHA-256: <span class="hash">${htmlEscape(report.evidenceHash)}</span></div></header><section class="summary">${summary}</section>${table}<p class="meta">This report is generated from the Neptune records visible to the requesting identity. The evidence hash identifies this generated payload; it is not a digital signature or an external certification.</p></body></html>`;
}
