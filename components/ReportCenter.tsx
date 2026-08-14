"use client";

import Link from "next/link";
import { useState } from "react";

const REPORTS = [
  ["fleet_summary", "Fleet executive summary", "Fleet-wide readiness and workload. Organization managers only."],
  ["vessel_readiness", "Vessel readiness", "Readiness evidence for vessels visible to your identity."],
  ["certificates", "Certificate evidence", "Certificate records and compliance attention windows."],
  ["maintenance", "Maintenance & work orders", "Visible work-order evidence and open maintenance state."],
  ["incidents", "Incidents & corrective actions", "Visible incident records and closeout state."],
  ["emergency_gps", "Emergency GPS chronology", "Most recent visible emergency event and ordered position trail."],
  ["audit", "Immutable audit evidence", "Organization-wide append-only audit stream. Organization managers only."]
];

export function ReportCenter() {
  const [type, setType] = useState("vessel_readiness");
  const [preview, setPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setLoading(true); setError(""); setPreview(null);
    const response = await fetch(`/api/v1/reports?type=${encodeURIComponent(type)}`, { cache: "no-store" });
    if (response.status === 401) { window.location.href = "/login?from=/reports"; return; }
    if (response.status === 402) { window.location.href = "/trial-expired?from=/reports"; return; }
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) { setError(result.error || "Unable to generate report."); return; }
    setPreview(result);
  }

  return <main className="section" style={{ minHeight: "100vh", paddingTop: 28 }}><div className="container" style={{ display: "grid", gap: 18 }}>
    <div className="workspace-header"><div><p className="eyebrow">Enterprise evidence</p><h1>Reports & evidence packages</h1><p className="muted">Generate identity-scoped reports with a report ID and SHA-256 evidence hash. CSV downloads and print-ready views are generated server-side from the records the requesting user is authorized to see.</p></div><div className="actions"><Link className="btn" href="/dashboard">Command</Link><Link className="btn" href="/approvals">Approvals</Link><Link className="btn gold" href="/security-center">Security Center</Link></div></div>
    {error && <div className="form-message error">{error}</div>}
    <article className="record"><p className="eyebrow">Generate</p><h3>Select an evidence package</h3><div className="form"><label>Report type<select value={type} onChange={event => setType(event.target.value)}>{REPORTS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><p className="muted">{REPORTS.find(([value]) => value === type)?.[2]}</p><div className="actions"><button className="btn gold" disabled={loading} onClick={generate}>{loading ? "Generating..." : "Generate report"}</button><a className="btn" href={`/api/v1/reports?type=${encodeURIComponent(type)}&format=csv`}>Download CSV</a><a className="btn" target="_blank" rel="noreferrer" href={`/api/v1/reports?type=${encodeURIComponent(type)}&format=html`}>Print / Save as PDF</a></div></div></article>
    {preview && <article className="record"><div className="workspace-header"><div><p className="eyebrow">Generated evidence</p><h3>{preview.title}</h3><p className="muted">{preview.organization?.name} · {new Date(preview.generatedAt).toLocaleString()}</p></div><span className="status configured">{preview.rows?.length || 0} records</span></div><div className="record-grid"><article className="record"><span className="muted">Report ID</span><code style={{ overflowWrap: "anywhere" }}>{preview.reportId}</code></article><article className="record"><span className="muted">Evidence SHA-256</span><code style={{ overflowWrap: "anywhere" }}>{preview.evidenceHash}</code></article></div><div className="data-grid" style={{ marginTop: 14 }}>{preview.rows?.length ? <table><thead><tr>{Object.keys(preview.rows[0]).slice(0,8).map((key: string) => <th key={key}>{key.replaceAll("_"," ")}</th>)}</tr></thead><tbody>{preview.rows.slice(0,25).map((row: any, index: number) => <tr key={row.id || index}>{Object.keys(preview.rows[0]).slice(0,8).map((key: string) => <td key={key}>{typeof row[key] === "object" ? JSON.stringify(row[key]) : String(row[key] ?? "—")}</td>)}</tr>)}</tbody></table> : <p className="muted">No records matched the report.</p>}</div>{preview.rows?.length > 25 && <p className="muted">Preview shows the first 25 rows. Download the CSV or open the print-ready view for the complete package.</p>}<p className="muted" style={{ marginTop: 14 }}>The evidence hash identifies this generated payload. It is not a digital signature, certification, or substitute for the source records.</p></article>}
  </div></main>;
}
