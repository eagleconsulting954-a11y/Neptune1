"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Account = {
  id: string;
  company: string;
  contact?: string;
  email?: string;
  stage?: string;
  annual_value?: number | string;
};

type AdminData = {
  organization: { id: string; role: string; email?: string };
  summary: Record<string, number>;
  stages: { name: string; count: number; value: number }[];
  crm: Account[];
  operational: { label: string; value: number; suffix: string }[];
  trend: { month: string; pipeline: number; activity: number }[];
  recentActivity: { id: string; label: string; body?: string; actor?: string; created_at?: string }[];
};

const blankAccount: Partial<Account> = { company: "", contact: "", email: "", stage: "Qualified", annual_value: 0 };

export function AdminDashboard() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("All stages");
  const [modal, setModal] = useState<Partial<Account> | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const response = await fetch("/api/v1/admin/analytics", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (response.status === 403) {
      setMessage("This workspace requires an administrator account.");
      setLoading(false);
      return;
    }
    setData(await response.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const accounts = useMemo(() => {
    const rows = data?.crm || [];
    return rows.filter(account => {
      const matchesStage = stage === "All stages" || account.stage === stage;
      const needle = query.trim().toLowerCase();
      const matchesQuery = !needle || [account.company, account.contact, account.email, account.stage].join(" ").toLowerCase().includes(needle);
      return matchesStage && matchesQuery;
    });
  }, [data, query, stage]);

  const stageOptions = useMemo(() => ["All stages", ...Array.from(new Set((data?.crm || []).map(account => account.stage || "Unassigned")))], [data]);
  const maxPipeline = Math.max(...(data?.trend || []).map(item => item.pipeline), 1);
  const maxStage = Math.max(...(data?.stages || []).map(item => item.value), 1);

  async function saveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const payload = { ...values, annual_value: Number(values.annual_value || 0), ...(modal.id ? { id: modal.id } : {}) };
    const response = await fetch("/api/v1/crm_accounts", {
      method: modal.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "Unable to save the CRM account.");
      return;
    }
    setModal(null);
    setMessage(modal.id ? "CRM account updated." : "CRM account created.");
    await load();
  }

  async function changeStage(account: Account, nextStage: string) {
    const response = await fetch("/api/v1/crm_accounts", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: account.id, stage: nextStage })
    });
    if (response.ok) {
      setMessage(`${account.company} moved to ${nextStage}.`);
      await load();
    }
  }

  async function removeAccount(account: Account) {
    if (!window.confirm(`Delete ${account.company}?`)) return;
    const response = await fetch(`/api/v1/crm_accounts?id=${encodeURIComponent(account.id)}`, { method: "DELETE" });
    if (response.ok) {
      setMessage("CRM account deleted.");
      await load();
    }
  }

  function exportCsv() {
    const columns = ["Company", "Contact", "Email", "Stage", "Annual Value"];
    const rows = accounts.map(account => [account.company, account.contact || "", account.email || "", account.stage || "", String(account.annual_value || 0)]);
    const csv = [columns, ...rows].map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "neptune-crm-export.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("CRM export downloaded.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <main className="admin-shell">
      <aside className="admin-rail glass">
        <Link className="brand admin-brand" href="/"><span className="brand-mark">✦</span><span>NEPTUNE<small>Administration</small></span></Link>
        <nav className="admin-nav">
          <a className="active" href="#overview">Overview</a>
          <a href="#analytics">Analytics</a>
          <a href="#crm">CRM pipeline</a>
          <a href="#activity">Activity</a>
        </nav>
        <div className="admin-rail-actions">
          <Link className="btn" href="/dashboard">Vessel dashboard</Link>
          <button className="btn danger" onClick={logout}>Logout</button>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div><p className="eyebrow">Administrator Workspace</p><h1>CRM & analytics command.</h1></div>
          <div className="actions"><button className="btn" onClick={load}>Refresh data</button><button className="btn" onClick={exportCsv}>Export CRM</button><button className="btn gold" onClick={() => setModal(blankAccount)}>Add account</button></div>
        </header>

        {message && <div className="form-message admin-message">{message}</div>}
        {loading || !data ? <section className="admin-loading glass"><div className="radar" /><p>Loading Neptune administration data...</p></section> : <>
          <section className="admin-kpis" id="overview">
            <Metric label="CRM accounts" value={data.summary.accounts} />
            <Metric label="Total pipeline" value={`$${Number(data.summary.pipeline).toLocaleString()}`} />
            <Metric label="Weighted pipeline" value={`$${Number(data.summary.weightedPipeline).toLocaleString()}`} />
            <Metric label="Average deal" value={`$${Number(data.summary.averageDeal).toLocaleString()}`} />
            <Metric label="Fleet readiness" value={`${data.summary.fleetReadiness}%`} />
            <Metric label="Critical items" value={data.summary.criticalItems} />
          </section>

          <section className="admin-grid" id="analytics">
            <article className="admin-panel glass premium admin-wide">
              <div className="admin-panel-head"><div><p className="eyebrow">Pipeline Analytics</p><h2>Commercial momentum</h2></div><span className="status">Live CRM data</span></div>
              <div className="trend-chart">{data.trend.map(item => <div className="trend-column" key={item.month}><div className="trend-bar-wrap"><div className="trend-bar" style={{height:`${Math.max(10, item.pipeline / maxPipeline * 100)}%`}}><span>${Math.round(item.pipeline / 1000)}k</span></div></div><b>{item.month}</b></div>)}</div>
            </article>

            <article className="admin-panel glass premium">
              <div className="admin-panel-head"><div><p className="eyebrow">Stage Distribution</p><h2>Pipeline health</h2></div></div>
              <div className="stage-list">{data.stages.map(item => <div className="stage-row" key={item.name}><div><b>{item.name}</b><span>{item.count} account{item.count === 1 ? "" : "s"}</span></div><div className="stage-track"><i style={{width:`${Math.max(8, item.value / maxStage * 100)}%`}} /></div><strong>${Number(item.value).toLocaleString()}</strong></div>)}</div>
            </article>

            <article className="admin-panel glass premium">
              <div className="admin-panel-head"><div><p className="eyebrow">Operational Analytics</p><h2>Fleet signals</h2></div></div>
              <div className="ops-analytics">{data.operational.map(item => <div key={item.label}><span>{item.label}</span><b>{item.value}{item.suffix}</b></div>)}</div>
            </article>
          </section>

          <section className="admin-panel glass premium" id="crm">
            <div className="admin-panel-head admin-crm-head"><div><p className="eyebrow">CRM Administration</p><h2>Accounts and opportunities</h2></div><div className="crm-tools"><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search company, contact, or email" /><select value={stage} onChange={event => setStage(event.target.value)}>{stageOptions.map(option => <option key={option}>{option}</option>)}</select></div></div>
            <div className="data-grid admin-table"><table><thead><tr><th>Company</th><th>Contact</th><th>Email</th><th>Stage</th><th>Annual value</th><th>Actions</th></tr></thead><tbody>{accounts.map(account => <tr key={account.id}><td><b>{account.company}</b></td><td>{account.contact || "—"}</td><td>{account.email || "—"}</td><td><select className="table-select" value={account.stage || "Qualified"} onChange={event => changeStage(account, event.target.value)}><option>Lead</option><option>Qualified</option><option>Demo booked</option><option>Proposal</option><option>Negotiation</option><option>Won</option><option>Lost</option></select></td><td>${Number(account.annual_value || 0).toLocaleString()}</td><td><div className="actions"><button className="btn" onClick={() => setModal(account)}>Edit</button><button className="btn danger" onClick={() => removeAccount(account)}>Delete</button></div></td></tr>)}</tbody></table></div>
          </section>

          <section className="admin-panel glass premium" id="activity">
            <div className="admin-panel-head"><div><p className="eyebrow">Audit Stream</p><h2>Recent platform activity</h2></div></div>
            <div className="admin-activity">{data.recentActivity.length ? data.recentActivity.map(event => <div key={event.id}><span className="activity-dot" /><div><b>{event.label}</b><p>{event.body || "Operational event recorded."}</p></div><small>{event.actor || "Neptune"}</small></div>) : <p className="muted">No recent activity recorded.</p>}</div>
          </section>
        </>}
      </section>

      {modal && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}><section className="modal glass premium"><div className="modal-head"><div><p className="eyebrow">CRM Account</p><h2>{modal.id ? "Edit account" : "Add account"}</h2></div><button className="modal-close" onClick={() => setModal(null)}>×</button></div><form className="form" onSubmit={saveAccount}><label>Company<input name="company" required defaultValue={modal.company || ""} /></label><label>Contact<input name="contact" defaultValue={modal.contact || ""} /></label><label>Email<input name="email" type="email" defaultValue={modal.email || ""} /></label><label>Stage<select name="stage" defaultValue={modal.stage || "Qualified"}><option>Lead</option><option>Qualified</option><option>Demo booked</option><option>Proposal</option><option>Negotiation</option><option>Won</option><option>Lost</option></select></label><label>Annual value<input name="annual_value" type="number" min="0" required defaultValue={modal.annual_value || 0} /></label><div className="actions"><button className="btn gold">Save account</button><button className="btn" type="button" onClick={() => setModal(null)}>Cancel</button></div></form></section></div>}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <article className="admin-metric glass premium"><span>{label}</span><b>{value}</b><i /></article>;
}
