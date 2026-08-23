"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Account = {
  id: string;
  company: string;
  contact?: string | null;
  contact_title?: string | null;
  email?: string | null;
  phone?: string | null;
  stage?: string | null;
  annual_value?: number | string | null;
  currency?: string | null;
  probability?: number | string | null;
  owner?: string | null;
  source?: string | null;
  expected_close_at?: string | null;
  next_action?: string | null;
  next_action_at?: string | null;
  last_contact_at?: string | null;
  notes?: string | null;
  lost_reason?: string | null;
  stage_changed_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

type StageDefinition = { name: string; probability: number };
type StageMetric = { name: string; count: number; value: number; weighted: number };
type OwnerMetric = { name: string; count: number; value: number; weighted: number };
type SourceMetric = { name: string; count: number; value: number };
type ForecastMetric = { days: number; value: number; weighted: number };
type Activity = { id: string; label: string; body?: string; actor?: string; created_at?: string; action?: string };

type AdminData = {
  storageMode: "postgres" | "unconfigured";
  organization: { id: string; role: string; email?: string; plan?: string };
  summary: Record<string, number>;
  pipelineStages: StageDefinition[];
  stages: StageMetric[];
  owners: OwnerMetric[];
  sources: SourceMetric[];
  forecast: ForecastMetric[];
  alerts: { overdue: string[]; stale: string[]; closing30: string[] };
  crm: Account[];
  operational: { label: string; value: number; suffix: string }[];
  trend: { month: string; pipeline: number; won: number; activity: number }[];
  recentActivity: Activity[];
};

const DEFAULT_STAGES: StageDefinition[] = [
  { name: "Lead", probability: 10 },
  { name: "Qualified", probability: 30 },
  { name: "Demo booked", probability: 45 },
  { name: "Proposal", probability: 65 },
  { name: "Negotiation", probability: 80 },
  { name: "Won", probability: 100 },
  { name: "Lost", probability: 0 }
];

const blankAccount: Partial<Account> = {
  company: "",
  contact: "",
  email: "",
  stage: "Qualified",
  annual_value: 0,
  currency: "USD",
  probability: 30,
  owner: "",
  source: "",
  expected_close_at: "",
  next_action: "",
  next_action_at: "",
  last_contact_at: "",
  notes: ""
};

function money(value: unknown, currency = "USD") {
  const amount = Number(value || 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD", maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `$${amount.toLocaleString()}`;
  }
}

function shortDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function dateTime(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function localDateTime(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function stageProbability(stages: StageDefinition[], stage: string) {
  return stages.find(item => item.name === stage)?.probability ?? 30;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export function AdminDashboard() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("All stages");
  const [owner, setOwner] = useState("All owners");
  const [view, setView] = useState<"board" | "table">("board");
  const [modal, setModal] = useState<Partial<Account> | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const response = await fetch("/api/v1/admin/analytics", { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/login?from=/admin";
      return;
    }
    if (response.status === 402) {
      window.location.href = "/trial-expired?from=/admin";
      return;
    }
    if (response.status === 403) {
      setMessage("This workspace is restricted to the two designated Neptune administrators.");
      setLoading(false);
      return;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error || "Unable to load administrator data.");
      setLoading(false);
      return;
    }
    setData(payload);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const stages = data?.pipelineStages?.length ? data.pipelineStages : DEFAULT_STAGES;
  const stageNames = stages.map(item => item.name);
  const owners = useMemo(() => ["All owners", ...Array.from(new Set((data?.crm || []).map(account => account.owner || "Unassigned"))).sort()], [data]);

  const accounts = useMemo(() => {
    const rows = data?.crm || [];
    const needle = query.trim().toLowerCase();
    return rows.filter(account => {
      const matchesStage = stage === "All stages" || account.stage === stage;
      const accountOwner = account.owner || "Unassigned";
      const matchesOwner = owner === "All owners" || accountOwner === owner;
      const matchesQuery = !needle || [
        account.company, account.contact, account.contact_title, account.email, account.phone, account.owner,
        account.source, account.stage, account.next_action, account.notes
      ].join(" ").toLowerCase().includes(needle);
      return matchesStage && matchesOwner && matchesQuery;
    });
  }, [data, query, stage, owner]);

  const databaseReady = data?.storageMode === "postgres";
  const maxTrend = Math.max(...(data?.trend || []).flatMap(item => [item.pipeline, item.won]), 1);
  const maxStage = Math.max(...(data?.stages || []).map(item => item.value), 1);
  const overdueIds = useMemo(() => new Set(data?.alerts?.overdue || []), [data]);
  const staleIds = useMemo(() => new Set(data?.alerts?.stale || []), [data]);
  const closingIds = useMemo(() => new Set(data?.alerts?.closing30 || []), [data]);

  function openNew() {
    setModal({ ...blankAccount });
    setMessage("");
  }

  function openEdit(account: Account) {
    setModal({ ...account });
    setMessage("");
  }

  async function crmRequest(method: "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>, id?: string) {
    const url = id ? `/api/v1/admin/crm?id=${encodeURIComponent(id)}` : "/api/v1/admin/crm";
    const response = await fetch(url, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) window.location.href = "/login?from=/admin";
    if (response.status === 402) window.location.href = "/trial-expired?from=/admin";
    if (!response.ok) throw new Error(result.error || "Unable to update CRM data.");
    return result;
  }

  async function saveAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || saving) return;
    setSaving(true);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      const payload: Record<string, unknown> = {
        ...values,
        annual_value: Number(values.annual_value || 0),
        probability: Number(values.probability || 0),
        expected_close_at: values.expected_close_at || null,
        next_action_at: values.next_action_at ? new Date(String(values.next_action_at)).toISOString() : null,
        last_contact_at: values.last_contact_at ? new Date(String(values.last_contact_at)).toISOString() : null
      };
      if (modal.id) payload.id = modal.id;
      await crmRequest(modal.id ? "PATCH" : "POST", payload);
      setModal(null);
      setMessage(modal.id ? "Opportunity updated and pipeline analytics recalculated." : "Opportunity added to the live pipeline.");
      await load(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save the opportunity.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStage(account: Account, nextStage: string) {
    try {
      await crmRequest("PATCH", { id: account.id, stage: nextStage });
      setMessage(`${account.company} moved to ${nextStage}.`);
      await load(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update the opportunity stage.");
    }
  }

  async function logContact(account: Account) {
    try {
      await crmRequest("PATCH", { id: account.id, last_contact_at: new Date().toISOString() });
      setMessage(`Contact activity logged for ${account.company}.`);
      await load(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to log contact activity.");
    }
  }

  async function removeAccount(account: Account) {
    if (!window.confirm(`Delete ${account.company} from the CRM? The immutable audit record will remain.`)) return;
    try {
      await crmRequest("DELETE", undefined, account.id);
      setMessage(`${account.company} was removed from the CRM dataset.`);
      await load(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete the opportunity.");
    }
  }

  function exportCsv() {
    if (!accounts.length) {
      setMessage("There are no CRM records matching the current filters.");
      return;
    }
    const columns = [
      "Company", "Contact", "Title", "Email", "Phone", "Owner", "Source", "Stage", "Annual Value", "Currency",
      "Probability", "Expected Close", "Next Action", "Next Action At", "Last Contact", "Lost Reason", "Notes", "Created", "Updated"
    ];
    const rows = accounts.map(account => [
      account.company, account.contact, account.contact_title, account.email, account.phone, account.owner, account.source,
      account.stage, account.annual_value, account.currency, account.probability, account.expected_close_at, account.next_action,
      account.next_action_at, account.last_contact_at, account.lost_reason, account.notes, account.created_at, account.updated_at
    ]);
    const csv = [columns, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `neptune-crm-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("Filtered CRM data exported.");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <main className="admin-shell admin-crm-enterprise">
      <aside className="admin-rail glass">
        <Link className="brand admin-brand" href="/"><span className="brand-mark">✦</span><span>NEPTUNE<small>Administration</small></span></Link>
        <nav className="admin-nav">
          <a className="active" href="#overview">Overview</a>
          <a href="#forecast">Forecast</a>
          <a href="#pipeline">Pipeline</a>
          <a href="#analytics">Analytics</a>
          <a href="#activity">Audit activity</a>
        </nav>
        <div className="admin-rail-actions">
          <Link className="btn" href="/platform-admin">Platform admin</Link>
          <Link className="btn" href="/dashboard">Vessel dashboard</Link>
          <button className="btn danger" onClick={logout}>Logout</button>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar crm-admin-topbar">
          <div>
            <p className="eyebrow">Administrator CRM</p>
            <h1>Commercial pipeline command.</h1>
            <p className="muted crm-subtitle">Live opportunity records, weighted forecast, follow-up control and immutable administrator activity.</p>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => load()}>Refresh data</button>
            <button className="btn" onClick={exportCsv}>Export CRM</button>
            <button className="btn gold" disabled={!databaseReady} onClick={openNew}>Add opportunity</button>
          </div>
        </header>

        {message && <div className="form-message admin-message" role="status">{message}</div>}
        {loading || !data ? <section className="admin-loading glass"><div className="radar" /><p>Loading live CRM and administrator data...</p></section> : <>
          {!databaseReady && <section className="admin-panel glass production-warning"><p className="eyebrow">Production database required</p><h2>No demo CRM data is shown.</h2><p className="muted">Connect PostgreSQL before creating persistent opportunities. Neptune does not substitute sample pipeline records on this administrator page.</p></section>}

          <section className="admin-kpis crm-kpi-grid" id="overview">
            <Metric label="Active pipeline" value={money(data.summary.pipeline)} detail={`${data.summary.activeOpportunities || 0} active opportunities`} />
            <Metric label="Weighted pipeline" value={money(data.summary.weightedPipeline)} detail="Probability-adjusted" />
            <Metric label="Average active deal" value={money(data.summary.averageDeal)} detail="Open opportunities only" />
            <Metric label="Win rate" value={`${Number(data.summary.conversionRate || 0).toFixed(1)}%`} detail="Won ÷ closed opportunities" />
            <Metric label="Won value" value={money(data.summary.wonValue)} detail="Closed-won opportunity value" />
            <Metric label="Overdue follow-ups" value={data.summary.overdueFollowUps || 0} detail="Next action is past due" alert={Boolean(data.summary.overdueFollowUps)} />
            <Metric label="Stale opportunities" value={data.summary.staleOpportunities || 0} detail="No contact for 14+ days" alert={Boolean(data.summary.staleOpportunities)} />
            <Metric label="Fleet readiness" value={`${data.summary.fleetReadiness || 0}%`} detail={`${data.summary.criticalItems || 0} critical operating items`} />
          </section>

          <section className="admin-panel glass premium crm-forecast-panel" id="forecast">
            <div className="admin-panel-head"><div><p className="eyebrow">Revenue Forecast</p><h2>Expected-close windows</h2></div><span className="status">Live opportunity dates</span></div>
            <div className="crm-forecast-grid">
              {(data.forecast || []).map(item => <article key={item.days}><span>Next {item.days} days</span><b>{money(item.value)}</b><small>{money(item.weighted)} weighted</small></article>)}
              <article><span>Closing within 30 days</span><b>{data.summary.closing30Days || 0}</b><small>Active opportunities</small></article>
            </div>
          </section>

          <section className="admin-panel glass premium crm-pipeline-section" id="pipeline">
            <div className="admin-panel-head admin-crm-head">
              <div><p className="eyebrow">CRM Pipeline</p><h2>Accounts and opportunities</h2></div>
              <div className="crm-view-switch" aria-label="Pipeline view">
                <button className={`btn ${view === "board" ? "active" : ""}`} onClick={() => setView("board")}>Board</button>
                <button className={`btn ${view === "table" ? "active" : ""}`} onClick={() => setView("table")}>Table</button>
              </div>
            </div>

            <div className="crm-filter-bar">
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search company, contact, owner, action, source..." aria-label="Search CRM" />
              <select value={stage} onChange={event => setStage(event.target.value)} aria-label="Filter by stage"><option>All stages</option>{stageNames.map(option => <option key={option}>{option}</option>)}</select>
              <select value={owner} onChange={event => setOwner(event.target.value)} aria-label="Filter by owner">{owners.map(option => <option key={option}>{option}</option>)}</select>
              <span className="crm-filter-count">{accounts.length} shown</span>
            </div>

            {view === "board" ? <PipelineBoard
              accounts={accounts}
              stages={stages}
              metrics={data.stages || []}
              overdueIds={overdueIds}
              staleIds={staleIds}
              closingIds={closingIds}
              onEdit={openEdit}
              onStage={changeStage}
              onContact={logContact}
            /> : <PipelineTable
              accounts={accounts}
              stages={stages}
              overdueIds={overdueIds}
              staleIds={staleIds}
              onEdit={openEdit}
              onDelete={removeAccount}
              onStage={changeStage}
              onContact={logContact}
            />}
          </section>

          <section className="admin-grid crm-analytics-grid" id="analytics">
            <article className="admin-panel glass premium admin-wide">
              <div className="admin-panel-head"><div><p className="eyebrow">Pipeline Creation & Wins</p><h2>Six-month commercial movement</h2></div><span className="status">Persisted records</span></div>
              {(data.trend || []).some(item => item.pipeline > 0 || item.won > 0) ? <div className="trend-chart crm-trend-chart">{data.trend.map(item => <div className="trend-column" key={item.month}><div className="trend-bar-wrap crm-double-bars"><div className="trend-bar crm-created" style={{height:`${Math.max(item.pipeline ? 4 : 0, item.pipeline / maxTrend * 100)}%`}}><span>{item.pipeline ? `$${Math.round(item.pipeline / 1000)}k` : ""}</span></div><div className="trend-bar crm-won" style={{height:`${Math.max(item.won ? 4 : 0, item.won / maxTrend * 100)}%`}}><span>{item.won ? `$${Math.round(item.won / 1000)}k` : ""}</span></div></div><b>{item.month}</b><small>{item.activity} audit events</small></div>)}</div> : <EmptyState title="No pipeline history yet" body="Add real CRM opportunities to begin building commercial analytics." />}
              <div className="crm-chart-legend"><span><i className="legend-created" />Opportunity value by creation month</span><span><i className="legend-won" />Current won value by close-stage month</span></div>
            </article>

            <article className="admin-panel glass premium">
              <div className="admin-panel-head"><div><p className="eyebrow">Stage Distribution</p><h2>Pipeline health</h2></div></div>
              {(data.stages || []).some(item => item.count) ? <div className="stage-list">{data.stages.filter(item => item.count).map(item => <div className="stage-row" key={item.name}><div><b>{item.name}</b><span>{item.count} opportunit{item.count === 1 ? "y" : "ies"}</span></div><div className="stage-track"><i style={{width:`${Math.max(8, item.value / maxStage * 100)}%`}} /></div><strong>{money(item.value)}</strong><small>{money(item.weighted)} weighted</small></div>)}</div> : <EmptyState title="No stage data" body="Your CRM pipeline is empty." />}
            </article>

            <article className="admin-panel glass premium">
              <div className="admin-panel-head"><div><p className="eyebrow">Owner Coverage</p><h2>Active pipeline by owner</h2></div></div>
              {data.owners?.length ? <div className="crm-rank-list">{data.owners.map(item => <div key={item.name}><span><b>{item.name}</b><small>{item.count} active</small></span><strong>{money(item.weighted)}</strong></div>)}</div> : <EmptyState title="No owner assignments" body="Assign opportunity owners to create accountability." />}
            </article>

            <article className="admin-panel glass premium">
              <div className="admin-panel-head"><div><p className="eyebrow">Lead Sources</p><h2>Opportunity origin</h2></div></div>
              {data.sources?.length ? <div className="crm-rank-list">{data.sources.slice(0, 8).map(item => <div key={item.name}><span><b>{item.name}</b><small>{item.count} total</small></span><strong>{money(item.value)}</strong></div>)}</div> : <EmptyState title="No source data" body="Record source on each opportunity to measure acquisition channels." />}
            </article>

            <article className="admin-panel glass premium">
              <div className="admin-panel-head"><div><p className="eyebrow">Operational Analytics</p><h2>Fleet signals</h2></div></div>
              <div className="ops-analytics">{data.operational.map(item => <div key={item.label}><span>{item.label}</span><b>{item.value}{item.suffix}</b></div>)}</div>
            </article>
          </section>

          <section className="admin-panel glass premium" id="activity">
            <div className="admin-panel-head"><div><p className="eyebrow">Immutable Audit Stream</p><h2>Recent administrator and platform activity</h2></div><span className="status">Append-only evidence</span></div>
            <div className="admin-activity crm-audit-stream">{data.recentActivity.length ? data.recentActivity.map(event => <div key={event.id}><span className="activity-dot" /><div><b>{event.label}</b><p>{event.body || "Administrative event recorded."}</p><small>{dateTime(event.created_at)}</small></div><small>{event.actor || "Neptune"}</small></div>) : <EmptyState title="No audit activity yet" body="Administrator actions will appear here as Neptune is used." />}</div>
          </section>
        </>}
      </section>

      {modal && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}>
        <section className="modal glass premium crm-opportunity-modal" role="dialog" aria-modal="true" aria-label={modal.id ? "Edit CRM opportunity" : "Add CRM opportunity"}>
          <div className="modal-head"><div><p className="eyebrow">CRM Opportunity</p><h2>{modal.id ? `Edit ${modal.company || "opportunity"}` : "Add opportunity"}</h2></div><button className="modal-close" onClick={() => setModal(null)} aria-label="Close">×</button></div>
          <form className="form crm-form" onSubmit={saveAccount}>
            <div className="crm-form-grid">
              <label>Company<input name="company" required defaultValue={modal.company || ""} maxLength={180} /></label>
              <label>Contact<input name="contact" defaultValue={modal.contact || ""} maxLength={160} /></label>
              <label>Contact title<input name="contact_title" defaultValue={modal.contact_title || ""} maxLength={160} /></label>
              <label>Email<input name="email" type="email" defaultValue={modal.email || ""} maxLength={320} /></label>
              <label>Phone<input name="phone" defaultValue={modal.phone || ""} maxLength={80} /></label>
              <label>Owner<input name="owner" defaultValue={modal.owner || ""} maxLength={160} placeholder="Sales owner" /></label>
              <label>Source<input name="source" defaultValue={modal.source || ""} maxLength={160} placeholder="Referral, outbound, conference..." /></label>
              <label>Stage<select name="stage" value={modal.stage || "Qualified"} onChange={event => setModal(current => current ? { ...current, stage: event.target.value, probability: stageProbability(stages, event.target.value) } : current)}>{stageNames.map(option => <option key={option}>{option}</option>)}</select></label>
              <label>Annual value<input name="annual_value" type="number" min="0" step="0.01" required defaultValue={Number(modal.annual_value || 0)} /></label>
              <label>Currency<input name="currency" defaultValue={modal.currency || "USD"} maxLength={3} /></label>
              <label>Probability %<input name="probability" type="number" min="0" max="100" value={Number(modal.probability ?? stageProbability(stages, String(modal.stage || "Qualified")))} onChange={event => setModal(current => current ? { ...current, probability: Number(event.target.value) } : current)} /></label>
              <label>Expected close<input name="expected_close_at" type="date" defaultValue={modal.expected_close_at ? String(modal.expected_close_at).slice(0,10) : ""} /></label>
              <label>Last contact<input name="last_contact_at" type="datetime-local" defaultValue={localDateTime(modal.last_contact_at)} /></label>
              <label>Next action due<input name="next_action_at" type="datetime-local" defaultValue={localDateTime(modal.next_action_at)} /></label>
            </div>
            <label>Next action<input name="next_action" defaultValue={modal.next_action || ""} maxLength={500} placeholder="Schedule fleet review, send proposal, confirm decision date..." /></label>
            {modal.stage === "Lost" && <label>Lost reason<textarea name="lost_reason" defaultValue={modal.lost_reason || ""} maxLength={1000} rows={2} placeholder="Reason opportunity was lost" /></label>}
            <label>Notes<textarea name="notes" defaultValue={modal.notes || ""} maxLength={5000} rows={4} placeholder="Commercial notes, requirements, blockers, procurement context..." /></label>
            <div className="actions"><button className="btn gold" disabled={saving}>{saving ? "Saving..." : "Save opportunity"}</button><button className="btn" type="button" onClick={() => setModal(null)}>Cancel</button></div>
          </form>
        </section>
      </div>}
    </main>
  );
}

function Metric({ label, value, detail, alert = false }: { label: string; value: string | number; detail?: string; alert?: boolean }) {
  return <article className={`admin-metric glass premium ${alert ? "crm-metric-alert" : ""}`}><span>{label}</span><b>{value}</b>{detail && <small>{detail}</small>}<i /></article>;
}

function PipelineBoard({ accounts, stages, metrics, overdueIds, staleIds, closingIds, onEdit, onStage, onContact }: {
  accounts: Account[];
  stages: StageDefinition[];
  metrics: StageMetric[];
  overdueIds: Set<string>;
  staleIds: Set<string>;
  closingIds: Set<string>;
  onEdit: (account: Account) => void;
  onStage: (account: Account, stage: string) => void;
  onContact: (account: Account) => void;
}) {
  if (!accounts.length) return <EmptyState title="No opportunities match these filters" body="Change the filters or add a real opportunity." />;
  return <div className="crm-board">{stages.map(definition => {
    const rows = accounts.filter(account => (account.stage || "Qualified") === definition.name);
    const metric = metrics.find(item => item.name === definition.name);
    return <section className={`crm-lane crm-stage-${definition.name.toLowerCase().replaceAll(" ", "-")}`} key={definition.name}>
      <header><div><b>{definition.name}</b><span>{rows.length} shown · {money(metric?.value || 0)}</span></div><em>{definition.probability}%</em></header>
      <div className="crm-lane-cards">{rows.length ? rows.map(account => <article className="crm-card" key={account.id}>
        <div className="crm-card-title"><div><b>{account.company}</b><span>{account.contact || "No contact"}{account.contact_title ? ` · ${account.contact_title}` : ""}</span></div><strong>{money(account.annual_value, account.currency || "USD")}</strong></div>
        <div className="crm-card-meta"><span>{account.owner || "Unassigned"}</span><span>{Number(account.probability || 0)}% weighted</span></div>
        {(overdueIds.has(account.id) || staleIds.has(account.id) || closingIds.has(account.id)) && <div className="crm-card-alerts">{overdueIds.has(account.id) && <span>Follow-up overdue</span>}{staleIds.has(account.id) && <span>Stale 14+d</span>}{closingIds.has(account.id) && <span>Closing ≤30d</span>}</div>}
        <dl><div><dt>Close</dt><dd>{shortDate(account.expected_close_at)}</dd></div><div><dt>Next action</dt><dd>{account.next_action || "—"}</dd></div><div><dt>Due</dt><dd>{dateTime(account.next_action_at)}</dd></div></dl>
        <div className="crm-card-actions"><select value={account.stage || "Qualified"} onChange={event => onStage(account, event.target.value)} aria-label={`Change stage for ${account.company}`}>{stages.map(stage => <option key={stage.name}>{stage.name}</option>)}</select><button className="btn" onClick={() => onContact(account)}>Log contact</button><button className="btn" onClick={() => onEdit(account)}>Edit</button></div>
      </article>) : <p className="crm-lane-empty">No opportunities</p>}</div>
    </section>;
  })}</div>;
}

function PipelineTable({ accounts, stages, overdueIds, staleIds, onEdit, onDelete, onStage, onContact }: {
  accounts: Account[];
  stages: StageDefinition[];
  overdueIds: Set<string>;
  staleIds: Set<string>;
  onEdit: (account: Account) => void;
  onDelete: (account: Account) => void;
  onStage: (account: Account, stage: string) => void;
  onContact: (account: Account) => void;
}) {
  if (!accounts.length) return <EmptyState title="No CRM opportunities" body="Add your first real customer or opportunity." />;
  return <div className="data-grid admin-table crm-table"><table><thead><tr><th>Company</th><th>Contact</th><th>Owner</th><th>Stage</th><th>Value</th><th>Probability</th><th>Expected close</th><th>Next action</th><th>Last contact</th><th>Actions</th></tr></thead><tbody>{accounts.map(account => <tr key={account.id} className={overdueIds.has(account.id) || staleIds.has(account.id) ? "crm-row-alert" : ""}><td><b>{account.company}</b><small>{account.source || "Source unspecified"}</small></td><td>{account.contact || "—"}<small>{account.email || account.phone || ""}</small></td><td>{account.owner || "Unassigned"}</td><td><select className="table-select" value={account.stage || "Qualified"} onChange={event => onStage(account, event.target.value)}>{stages.map(stage => <option key={stage.name}>{stage.name}</option>)}</select></td><td>{money(account.annual_value, account.currency || "USD")}</td><td>{Number(account.probability || 0)}%</td><td>{shortDate(account.expected_close_at)}</td><td><b>{account.next_action || "—"}</b><small>{dateTime(account.next_action_at)}</small></td><td>{dateTime(account.last_contact_at)}</td><td><div className="actions"><button className="btn" onClick={() => onContact(account)}>Contact</button><button className="btn" onClick={() => onEdit(account)}>Edit</button><button className="btn danger" onClick={() => onDelete(account)}>Delete</button></div></td></tr>)}</tbody></table></div>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="admin-empty"><div className="icon">✦</div><h3>{title}</h3><p>{body}</p></div>;
}
