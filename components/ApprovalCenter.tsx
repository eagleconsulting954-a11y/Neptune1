"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const REQUIRED_ROLES = ["", "master", "chief_engineer", "safety_officer", "fleet_manager", "org_admin", "manager"];
const DECISIONS = [
  ["approve", "Approve"],
  ["request_changes", "Request changes"],
  ["reject", "Reject"],
  ["acknowledge", "Acknowledge"]
];

function when(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export function ApprovalCenter() {
  const [items, setItems] = useState<any[]>([]);
  const [vessels, setVessels] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [approvalResponse, dashboardResponse] = await Promise.all([
      fetch("/api/v1/approvals", { cache: "no-store" }),
      fetch("/api/v1/dashboard", { cache: "no-store" })
    ]);
    if (approvalResponse.status === 401 || dashboardResponse.status === 401) {
      window.location.href = "/login?from=/approvals";
      return;
    }
    if (approvalResponse.status === 402 || dashboardResponse.status === 402) {
      window.location.href = "/trial-expired?from=/approvals";
      return;
    }
    const approvals = await approvalResponse.json().catch(() => ({}));
    const dashboard = await dashboardResponse.json().catch(() => ({}));
    if (!approvalResponse.ok) setError(approvals.error || "Unable to load approvals.");
    else setItems(approvals.items || []);
    if (dashboardResponse.ok) setVessels(dashboard.vessels || []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/approvals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vesselId: form.get("vesselId") || null,
        resourceType: form.get("resourceType") || null,
        resourceId: form.get("resourceId") || null,
        title: form.get("title"),
        description: form.get("description"),
        requiredRole: form.get("requiredRole") || null,
        dueAt: form.get("dueAt") || null
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "Unable to create approval."); return; }
    event.currentTarget.reset();
    setMessage("Approval request created and added to the immutable evidence trail.");
    await load();
  }

  async function decide(requestId: string, event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/approvals", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        requestId,
        decision: form.get("decision"),
        comment: form.get("comment"),
        acknowledgment: form.get("acknowledgment")
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error || "Unable to record sign-off."); return; }
    setMessage("Authenticated sign-off recorded. The acknowledgment action is append-only.");
    await load();
  }

  return <main className="section" style={{ minHeight: "100vh", paddingTop: 28 }}><div className="container" style={{ display: "grid", gap: 18 }}>
    <div className="workspace-header"><div><p className="eyebrow">Enterprise governance</p><h1>Approvals & authenticated sign-off</h1><p className="muted">Route critical work for role-based approval while preserving revision, actor, decision, comment, timestamp, and evidence hash. This is an authenticated operational acknowledgment, not a claim of legal e-signature compliance.</p></div><div className="actions"><Link className="btn" href="/dashboard">Command</Link><Link className="btn" href="/security-center">Security Center</Link><Link className="btn gold" href="/reports">Reports</Link></div></div>
    {message && <div className="form-message success">{message}</div>}
    {error && <div className="form-message error">{error}</div>}

    <article className="record"><p className="eyebrow">New approval</p><h3>Request controlled sign-off</h3><form className="form" onSubmit={create}>
      <label>Title<input name="title" required placeholder="Hot work closeout · Critical maintenance · Incident closure" /></label>
      <label>Vessel<select name="vesselId"><option value="">Organization-level approval</option>{vessels.map(vessel => <option key={vessel.id} value={vessel.id}>{vessel.name}{vessel.imo ? ` · ${vessel.imo}` : ""}</option>)}</select></label>
      <label>Linked record type<input name="resourceType" placeholder="incident · duty · work_order · certificate" /></label>
      <label>Linked record ID<input name="resourceId" placeholder="Optional Neptune record ID" /></label>
      <label>Required approver role<select name="requiredRole">{REQUIRED_ROLES.map(role => <option key={role || "any"} value={role}>{role ? role.replaceAll("_", " ") : "Any permitted user"}</option>)}</select></label>
      <label>Due at<input name="dueAt" type="datetime-local" /></label>
      <label>Description<textarea name="description" rows={5} placeholder="Decision context, evidence expected, and acceptance criteria" /></label>
      <button className="btn gold">Create approval request</button>
    </form></article>

    {loading ? <p>Loading approval evidence...</p> : items.length ? <div style={{ display: "grid", gap: 14 }}>{items.map(item => <article className="record" key={item.id}>
      <div className="workspace-header"><div><p className="eyebrow">Revision {item.revision} · {item.required_role || "Any permitted approver"}</p><h3>{item.title}</h3><p>{item.description || "No additional description."}</p></div><span className={`status ${item.status === "approved" || item.status === "acknowledged" ? "configured" : ""}`}>{String(item.status || "pending").replaceAll("_", " ")}</span></div>
      <p className="muted">Vessel: {item.vessel_id || "Organization"} · Linked record: {item.resource_type || "—"} {item.resource_id || ""} · Due: {when(item.due_at)} · Updated: {when(item.updated_at)}</p>
      {(item.actions || []).length > 0 && <div className="data-grid"><table><thead><tr><th>Time</th><th>Actor</th><th>Role</th><th>Decision</th><th>Comment</th><th>Evidence hash</th></tr></thead><tbody>{item.actions.map((action: any) => <tr key={action.id}><td>{when(action.createdAt)}</td><td>{action.actorEmail || "—"}</td><td>{action.actorRole || "—"}</td><td>{String(action.decision).replaceAll("_", " ")}</td><td>{action.comment || "—"}</td><td><code>{String(action.acknowledgmentHash || "").slice(0, 16)}…</code></td></tr>)}</tbody></table></div>}
      {!['approved','rejected','closed'].includes(String(item.status)) && <form className="form" onSubmit={event => decide(item.id, event)} style={{ marginTop: 14 }}><label>Decision<select name="decision">{DECISIONS.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Comment<textarea name="comment" rows={3} placeholder="Decision rationale or requested changes" /></label><label>Authenticated acknowledgment<input name="acknowledgment" required placeholder="Type: I acknowledge this action" /></label><button className="btn gold">Record sign-off</button></form>}
    </article>)}</div> : <article className="record"><h3>No approval requests yet</h3><p className="muted">Create the first controlled approval above.</p></article>}
  </div></main>;
}
