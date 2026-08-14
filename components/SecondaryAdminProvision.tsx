"use client";

import { useEffect, useState } from "react";

export function SecondaryAdminProvision() {
  const [state, setState] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function load() {
    const response = await fetch("/api/platform-admin/provision-secondary", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (response.status === 403) {
      setLoading(false);
      return;
    }
    if (!response.ok) {
      setMessage(result.error || "Unable to load secondary administrator status.");
      setLoading(false);
      return;
    }
    setState(result);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function provision() {
    setSending(true);
    setMessage("");
    const response = await fetch("/api/platform-admin/provision-secondary", { method: "POST" });
    const result = await response.json().catch(() => ({}));
    setSending(false);
    if (!response.ok) {
      setMessage(result.error || "Unable to provision the secondary administrator.");
      return;
    }
    setState(result.status || state);
    setMessage(result.message || "Secure administrator invitation sent.");
  }

  if (loading || !state) return null;

  return <section className="container" style={{ paddingTop: 18 }}>
    <article className="record glass premium" style={{ display: "grid", gap: 12 }}>
      <div className="workspace-header"><div><p className="eyebrow">Privileged access control</p><h3>Secondary designated administrator</h3><p className="muted">The CRM and platform-admin allowlist is fixed in code. Provisioning creates the approved account through a one-time verified invitation; no shared password is generated.</p></div><span className={`status ${state.provisioned && state.active ? "configured" : ""}`}>{state.provisioned ? state.active ? "Active" : "Provisioned" : state.pendingInvitation ? "Invite pending" : "Not provisioned"}</span></div>
      <div><b>{state.email}</b><p className="muted" style={{ marginTop: 6 }}>{state.provisioned ? `Email verified: ${state.verified ? "Yes" : "No"} · Same organization: ${state.sameOrganization ? "Yes" : "No"}` : state.pendingInvitation ? `Invitation expires ${new Date(state.pendingInvitation.expires_at).toLocaleString()}` : "No account or current invitation was found."}</p></div>
      {!state.provisioned && !state.pendingInvitation && <button className="btn gold" disabled={sending} onClick={provision}>{sending ? "Sending secure invitation..." : "Provision secondary administrator"}</button>}
      {message && <div className={`form-message ${message.toLowerCase().includes("unable") ? "error" : "success"}`}>{message}</div>}
    </article>
  </section>;
}
