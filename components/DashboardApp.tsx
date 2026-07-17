"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DecisionCommandCenter } from "@/components/DecisionCommandCenter";
import { MaritimeIntelligence } from "@/components/MaritimeIntelligence";

const NAV_GROUPS: Record<string, string[]> = {
  Command: ["Command", "Vessels", "CRM"],
  "Voyage Intelligence": ["Maritime Intel"],
  Operations: ["Delegation", "Maintenance", "Certificates", "Incidents"],
  Workspace: ["Activity", "Billing", "Settings"]
};

const MODULE_BY_TAB: Record<string, string> = {
  Command: "command",
  Vessels: "vessels",
  "Maritime Intel": "maritime_intel",
  Delegation: "delegation",
  Maintenance: "maintenance",
  Certificates: "certificates",
  Incidents: "incidents",
  CRM: "crm",
  Activity: "activity",
  Billing: "billing",
  Settings: "settings"
};

const RESOURCE_BY_TAB: Record<string, string | null> = {
  Vessels: "vessels",
  Delegation: "duties",
  Maintenance: "work_orders",
  Certificates: "certificates",
  Incidents: "incidents",
  CRM: "crm_accounts",
  Activity: "activity_events",
  Billing: "subscriptions",
  Command: null,
  "Maritime Intel": null,
  Settings: null
};

const FORM_FIELDS: Record<string, { key: string; label: string; placeholder?: string; type?: string }[]> = {
  vessels: [
    { key: "name", label: "Vessel name", placeholder: "Vessel name" },
    { key: "vessel_type", label: "Vessel type", placeholder: "Tanker" },
    { key: "imo", label: "IMO number", placeholder: "IMO number" },
    { key: "status", label: "Status", placeholder: "En route" },
    { key: "readiness", label: "Readiness %", type: "number" },
    { key: "eta", label: "ETA", placeholder: "Destination and ETA" }
  ],
  duties: [
    { key: "category", label: "Duty type", placeholder: "Hot Work or Inspection" },
    { key: "title", label: "Duty title", placeholder: "Duty title" },
    { key: "owner", label: "Owner", placeholder: "Chief Officer" },
    { key: "location", label: "Location", placeholder: "Work location" },
    { key: "status", label: "Status", placeholder: "Master approval" },
    { key: "severity", label: "Severity", placeholder: "critical" },
    { key: "due_at", label: "Due", placeholder: "2026-08-12 16:00" }
  ],
  work_orders: [
    { key: "title", label: "Work order", placeholder: "Work order title" },
    { key: "owner", label: "Owner", placeholder: "Chief Engineer" },
    { key: "status", label: "Status", placeholder: "Parts pending" },
    { key: "priority", label: "Priority", placeholder: "high" },
    { key: "due_at", label: "Due", placeholder: "2026-08-15" }
  ],
  certificates: [
    { key: "name", label: "Certificate", placeholder: "Certificate name" },
    { key: "issuer", label: "Issuer", placeholder: "Class Society" },
    { key: "expires_at", label: "Expiry", type: "date" },
    { key: "status", label: "Status", placeholder: "Current" }
  ],
  incidents: [
    { key: "title", label: "Incident", placeholder: "Incident title" },
    { key: "severity", label: "Severity", placeholder: "low" },
    { key: "status", label: "Status", placeholder: "RCA open" },
    { key: "owner", label: "Owner", placeholder: "Safety Officer" }
  ],
  crm_accounts: [
    { key: "company", label: "Company", placeholder: "Company name" },
    { key: "contact", label: "Contact", placeholder: "Contact name" },
    { key: "email", label: "Email", type: "email" },
    { key: "stage", label: "Stage", placeholder: "Qualified" },
    { key: "annual_value", label: "Annual value", type: "number" }
  ],
  activity_events: [
    { key: "label", label: "Event", placeholder: "Port package approved" },
    { key: "body", label: "Details", placeholder: "Operational details" },
    { key: "actor", label: "Actor", placeholder: "Captain" }
  ]
};

type DashboardData = Record<string, any>;

function tabAllowed(data: DashboardData | null, tab: string) {
  if (!data) return true;
  const required = MODULE_BY_TAB[tab];
  const modules = data.entitlement?.access?.modules || [];
  return !required || modules.includes(required);
}

function includedKpis(data: DashboardData | null) {
  if (!data) return [];
  const modules: string[] = data.entitlement?.access?.modules || [];
  const kpis = data.kpis || {};
  const cards = [
    { module: "vessels", label: "Vessels", value: kpis.vessels || 0 },
    { module: "vessels", label: "Readiness", value: `${kpis.readiness || 0}%` },
    { module: "maritime_intel", label: "Monitored ports", value: kpis.ports || 0 },
    { module: "delegation", label: "Open duties", value: kpis.openDuties || 0 },
    { module: "maintenance", label: "Work orders", value: kpis.openWorkOrders || 0 },
    { module: "certificates", label: "Certificate alerts", value: kpis.expiringCertificates || 0 },
    { module: "incidents", label: "Open incidents", value: kpis.openIncidents || 0 },
    { module: "crm", label: "CRM pipeline", value: `$${Number(kpis.pipeline || 0).toLocaleString()}` }
  ];
  return cards.filter(card => modules.includes(card.module));
}

export function DashboardApp() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState("Command");
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ resource: string; item?: any; title: string } | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/v1/dashboard", { cache: "no-store" });
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (res.status === 402) {
      window.location.href = "/trial-expired";
      return;
    }
    const result = await res.json();
    if (!res.ok) {
      setMessage(result.error || "Unable to load Neptune data.");
      setLoading(false);
      return;
    }
    setData(result);
    if (!tabAllowed(result, tab)) setTab("Command");
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  function itemsFor(resource: string | null) {
    if (!data || !resource) return [];
    const map: Record<string, string> = {
      vessels: "vessels",
      duties: "duties",
      work_orders: "workOrders",
      certificates: "certificates",
      incidents: "incidents",
      crm_accounts: "crm",
      activity_events: "events",
      subscriptions: "subscriptions"
    };
    return data[map[resource]] || [];
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    const form = new FormData(event.currentTarget);
    const body: Record<string, any> = Object.fromEntries(form.entries());
    if (modal.item?.id) body.id = modal.item.id;
    const res = await fetch(`/api/v1/${modal.resource}`, {
      method: modal.item?.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await res.json();
    if (res.status === 402) {
      window.location.href = "/trial-expired";
      return;
    }
    if (!res.ok) {
      setMessage(result.error || "Unable to save");
      return;
    }
    const wasUpdate = Boolean(modal.item?.id);
    setModal(null);
    setMessage(wasUpdate ? "Record updated. Decision signals recalculated." : "Record created. Decision signals recalculated from your organization data.");
    await load();
  }

  async function remove(resource: string, id: string) {
    if (!window.confirm("Delete this record?")) return;
    const res = await fetch(`/api/v1/${resource}?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await res.json().catch(() => ({}));
    if (res.status === 402) {
      window.location.href = "/trial-expired";
      return;
    }
    if (!res.ok) {
      setMessage(result.error || "Unable to delete record.");
      return;
    }
    setMessage("Record deleted. Decision signals recalculated.");
    await load();
  }

  function quickDuty(category: string) {
    if (!tabAllowed(data, "Delegation")) {
      setMessage("Delegation is included in Captain and Full Vessel Access packages.");
      return;
    }
    setModal({
      resource: "duties",
      title: `New ${category} duty`,
      item: {
        category,
        owner: category === "Hot Work" ? "Chief Officer" : "Safety Officer",
        status: "Open",
        severity: category === "Hot Work" ? "critical" : "normal",
        due_at: new Date().toISOString().slice(0, 16).replace("T", " ")
      }
    });
  }

  function chooseTab(next: string) {
    if (!tabAllowed(data, next)) {
      setMessage(`${next} is not included in the ${data?.entitlement?.planName || "current"} package. Upgrade to Full Vessel Access for the complete suite.`);
      setTab("Command");
      return;
    }
    setTab(next);
    setMenuOpen(false);
    setQuery("");
  }

  const visibleNavGroups = useMemo(() => Object.entries(NAV_GROUPS)
    .map(([group, items]) => [group, items.filter(item => tabAllowed(data, item))] as const)
    .filter(([, items]) => items.length), [data]);

  const resource = RESOURCE_BY_TAB[tab];
  const visible = useMemo(() => {
    const rows = itemsFor(resource);
    if (!query.trim()) return rows;
    const needle = query.toLowerCase();
    return rows.filter((row: any) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [data, resource, query]);

  const packageKpis = useMemo(() => includedKpis(data), [data]);
  const isMaritimeIntel = tab === "Maritime Intel";
  const isCommand = tab === "Command";
  const canDelegate = tabAllowed(data, "Delegation");
  const canUseAnalytics = Boolean(data?.entitlement?.access?.modules?.includes("analytics"));

  return (
    <div className={`dashboard-shell ${menuOpen ? "menu-open" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-head"><div className="brand"><span className="brand-mark">✦</span><span>NEPTUNE<small>Vessel Command</small></span></div><button className="menu-btn" onClick={() => setMenuOpen(false)}>×</button></div>
        <div className="sidebar-current"><b>{tab}</b><span>{isCommand ? "Fleet trends, alerts, and decision recommendations" : isMaritimeIntel ? "Weather, ocean, ports, bunkering, and rescue intelligence" : "Your organization workspace"}</span></div>
        {data?.entitlement && <div className="sidebar-current"><b>{data.entitlement.planName}</b><span>{data.entitlement.status === "trialing" ? `${data.entitlement.daysRemaining} trial days remaining` : "Active subscription"}</span></div>}
        {visibleNavGroups.map(([group, items]) => <details className="nav-group" open key={group}><summary>{group}<span>{items.length}</span></summary><div className="nav-grid">{items.map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => chooseTab(item)}>{item}</button>)}</div></details>)}
        {canUseAnalytics && <Link className="btn" style={{ width: "100%", marginTop: 12 }} href="/admin">CRM & Analytics Admin</Link>}
        <Link className="btn gold" style={{ width: "100%", marginTop: 8 }} href="/pricing">Change package</Link>
        <button className="btn danger" style={{ width: "100%", marginTop: 8 }} onClick={logout}>Logout</button>
      </aside>
      <button className="mobile-scrim" onClick={() => setMenuOpen(false)} aria-label="Close menu" />
      <main className="main">
        <header className="topbar"><button className="menu-btn" onClick={() => setMenuOpen(true)}>☰</button><div className="search"><input value={query} onChange={event => setQuery(event.target.value)} placeholder={isMaritimeIntel ? "Use the maritime location search below..." : isCommand ? "Open a module to search organization records..." : "Search your organization records..."} disabled={isMaritimeIntel || isCommand} style={{ background: "transparent", border: 0, outline: 0, width: "100%" }} /></div><button className="profile" onClick={() => chooseTab("Settings")}>FE</button></header>
        <section className={`workspace glass premium ${isMaritimeIntel ? "maritime-workspace" : ""}`}>
          {!isMaritimeIntel && !isCommand && <div className="workspace-header"><div><p className="eyebrow">Private Organization Workspace</p><h1>{tab}</h1><p className="muted">Every visible module and metric is limited to the access listed for your purchased package.</p></div><div className="actions">{canDelegate && <><button className="btn gold" onClick={() => quickDuty("Hot Work")}>Delegate hot work</button><button className="btn" onClick={() => quickDuty("Inspection")}>Assign inspection</button></>}{resource && FORM_FIELDS[resource] && <button className="btn" onClick={() => setModal({ resource, title: `New ${tab} record` })}>New record</button>}</div></div>}
          {message && <div className="form-message" style={{ marginTop: 12 }}>{message}</div>}
          {loading || !data ? <p className="lede">Loading your organization decision data...</p> : <>
            {!isMaritimeIntel && !isCommand && <div className="kpi-grid">{packageKpis.map(card => <div className="kpi" key={`${card.module}-${card.label}`}><span>{card.label}</span><b>{card.value}</b></div>)}</div>}
            {isCommand && <DecisionCommandCenter data={data} openTab={chooseTab} createVessel={() => setModal({ resource: "vessels", title: "Add your first vessel" })} createDuty={() => quickDuty("Inspection")} />}
            {isMaritimeIntel && <MaritimeIntelligence data={data} refresh={load} notify={setMessage} />}
            {tab === "Settings" && <Settings logout={logout} />}
            {resource && <ResourceView resource={resource} rows={visible} edit={item => setModal({ resource, item, title: `Edit ${tab} record` })} remove={id => remove(resource, id)} />}
          </>}
        </section>
      </main>
      {modal && <RecordModal modal={modal} close={() => setModal(null)} save={save} />}
    </div>
  );
}

function Settings({ logout }: { logout: () => void }) {
  return <div className="record-grid"><article className="record"><p className="eyebrow">Organization</p><h3>Organization profile</h3><p>Manage company profile, fleet defaults, and workspace branding.</p><button className="btn" onClick={() => alert("Organization settings require the settings API configuration.")}>Edit profile</button></article><article className="record"><p className="eyebrow">Security</p><h3>Signed sessions</h3><p>HTTP-only session cookies, organization isolation, and protected API routes are active.</p><button className="btn" onClick={() => alert("Connect an email provider to activate user invitations.")}>Invite user</button></article><article className="record"><p className="eyebrow">Account</p><h3>Session controls</h3><p>End the current secure operator session.</p><button className="btn danger" onClick={logout}>Logout</button></article></div>;
}

function ResourceView({ resource, rows, edit, remove }: { resource: string; rows: any[]; edit: (item: any) => void; remove: (id: string) => void }) {
  if (!rows.length) return <div className="record empty-organization-record"><p className="eyebrow">No organization data</p><h3>No records yet</h3><p>This module is intentionally empty until your team creates its first real record. The command dashboard will update as data is added.</p></div>;
  const columns = Object.keys(rows[0]).filter(key => !["org_id", "created_at", "password_hash"].includes(key)).slice(0, 7);
  return <div className="data-grid"><table><thead><tr>{columns.map(column => <th key={column}>{column.replaceAll("_", " ")}</th>)}<th>Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}>{columns.map(column => <td key={column}>{column === "annual_value" ? `$${Number(row[column] || 0).toLocaleString()}` : String(row[column] ?? "—")}</td>)}<td><div className="actions"><button className="btn" onClick={() => edit(row)}>Edit</button>{resource !== "subscriptions" && <button className="btn danger" onClick={() => remove(row.id)}>Delete</button>}</div></td></tr>)}</tbody></table></div>;
}

function RecordModal({ modal, close, save }: { modal: { resource: string; item?: any; title: string }; close: () => void; save: (event: React.FormEvent<HTMLFormElement>) => void }) {
  const fields = FORM_FIELDS[modal.resource] || [];
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><section className="modal glass premium"><div className="modal-head"><div><p className="eyebrow">Your Organization Record</p><h2>{modal.title}</h2></div><button className="modal-close" onClick={close}>×</button></div><form className="form" onSubmit={save}>{fields.map(field => <label key={field.key}>{field.label}<input name={field.key} type={field.type || "text"} min={field.key === "readiness" ? 0 : undefined} max={field.key === "readiness" ? 100 : undefined} required={!["imo", "eta", "issuer", "expires_at", "email"].includes(field.key)} defaultValue={modal.item?.[field.key] ?? ""} placeholder={field.placeholder} /></label>)}<div className="actions"><button className="btn gold">Save record</button><button className="btn" type="button" onClick={close}>Cancel</button></div></form></section></div>;
}
