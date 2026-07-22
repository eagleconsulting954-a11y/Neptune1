"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DecisionCommandCenter } from "@/components/DecisionCommandCenter";
import { MaritimeIntelligence } from "@/components/MaritimeIntelligence";
import { EVFutureProjects } from "@/components/EVFutureProjects";
import { NoOtherMaster } from "@/components/NoOtherMaster";

const NAV_GROUPS: Record<string, string[]> = {
  Command: ["Command", "Vessels", "CRM"],
  "Voyage Intelligence": ["Maritime Intel"],
  Operations: ["Delegation", "Maintenance", "Certificates", "Incidents"],
  "Safety & Welfare": ["No Other Master"],
  "Future Programs": ["EV Future"],
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
  "No Other Master": "seafarer_safety",
  "EV Future": "ev_projects",
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
  "No Other Master": null,
  "EV Future": null,
  Settings: null
};

type FormField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: string;
  options?: string[];
  optional?: boolean;
};

const FORM_FIELDS: Record<string, FormField[]> = {
  vessels: [
    { key: "name", label: "Vessel name", placeholder: "Vessel name" },
    { key: "vessel_type", label: "Vessel type", placeholder: "Tanker" },
    { key: "imo", label: "IMO number", placeholder: "IMO number", optional: true },
    { key: "status", label: "Status", options: ["In port", "At anchor", "En route", "Under maintenance", "Out of service"] },
    { key: "readiness", label: "Readiness %", type: "number" },
    { key: "eta", label: "ETA", placeholder: "Destination and ETA", optional: true }
  ],
  work_orders: [
    { key: "title", label: "Work order", placeholder: "Work order title" },
    { key: "owner", label: "Owner", placeholder: "Chief Engineer" },
    { key: "status", label: "Status", options: ["Open", "Planned", "In progress", "Parts pending", "Completed", "Closed"] },
    { key: "priority", label: "Priority", options: ["Low", "Normal", "High", "Critical"] },
    { key: "due_at", label: "Due", type: "datetime-local" }
  ],
  certificates: [
    { key: "name", label: "Certificate", placeholder: "Certificate name" },
    { key: "issuer", label: "Issuer", placeholder: "Class Society", optional: true },
    { key: "expires_at", label: "Expiry", type: "date", optional: true },
    { key: "status", label: "Status", options: ["Current", "Expiring soon", "Expired", "Renewal submitted"] }
  ],
  incidents: [
    { key: "title", label: "Incident", placeholder: "Incident title" },
    { key: "severity", label: "Severity", options: ["Low", "Normal", "High", "Critical"] },
    { key: "status", label: "Status", options: ["Open", "RCA open", "Corrective action", "Monitoring", "Resolved", "Closed"] },
    { key: "owner", label: "Owner", placeholder: "Safety Officer" }
  ],
  crm_accounts: [
    { key: "company", label: "Company", placeholder: "Company name" },
    { key: "contact", label: "Contact", placeholder: "Contact name" },
    { key: "email", label: "Email", type: "email", optional: true },
    { key: "stage", label: "Stage", options: ["Lead", "Qualified", "Demo booked", "Proposal", "Negotiation", "Won", "Lost"] },
    { key: "annual_value", label: "Annual value", type: "number" }
  ],
  activity_events: [
    { key: "label", label: "Event", placeholder: "Port package approved" },
    { key: "body", label: "Details", placeholder: "Operational details" },
    { key: "actor", label: "Actor", placeholder: "Captain" }
  ]
};

const DUTY_CATEGORIES = ["Hot Work", "Inspection", "Safety", "Navigation", "Cargo", "Maintenance"];
const DUTY_STATUS = ["Open", "Pending Master Approval", "Approved", "In Progress", "On Hold", "Completed", "Closed"];
const DUTY_SEVERITY = ["Normal", "High", "Critical"];
const DUTY_TITLES: Record<string, string[]> = {
  "Hot Work": ["Welding repair", "Cutting and grinding", "Brazing or soldering", "Boiler or burner work", "Hot work permit review"],
  Inspection: ["Safety equipment inspection", "Firefighting equipment inspection", "Deck inspection", "Engine-room inspection", "Cargo-space inspection", "Accommodation inspection"],
  Safety: ["Pre-job safety review", "Toolbox talk", "Emergency equipment check", "PPE compliance check"],
  Navigation: ["Passage plan review", "Bridge equipment check", "Chart and publication check", "Watch handover review"],
  Cargo: ["Cargo readiness inspection", "Cargo securing check", "Manifold inspection", "Tank or hold inspection"],
  Maintenance: ["Planned maintenance inspection", "Machinery condition check", "Repair verification", "Post-maintenance test"]
};

const DEFAULT_DUTY_OPTIONS = {
  owners: ["Master", "Chief Officer", "Safety Officer", "Chief Engineer", "Second Engineer", "Bosun", "Deck Officer", "Duty Engineer"],
  locations: ["Bridge", "Main Deck", "Cargo Deck", "Engine Room", "Workshop", "Pump Room", "Cargo Hold", "Accommodation", "Galley", "Ballast Tank"],
  configuredOwners: [] as string[],
  configuredLocations: [] as string[],
  isConfigured: false,
  updatedAt: null as string | null
};

type DutyOptions = typeof DEFAULT_DUTY_OPTIONS;
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

function preferredOption(options: string[], preferred: string) {
  return options.find(option => option.toLowerCase() === preferred.toLowerCase()) || options[0] || "";
}

function localDateTime(value: unknown) {
  if (!value) return "";
  const raw = String(value).replace(" ", "T");
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 16);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function defaultDutyDue() {
  const date = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function splitSetupValues(value: string) {
  const seen = new Set<string>();
  return value
    .split(/\n|,/)
    .map(item => item.trim())
    .filter(Boolean)
    .filter(item => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function DashboardApp() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState("Command");
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ resource: string; item?: any; title: string } | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [dutyOptions, setDutyOptions] = useState<DutyOptions>(DEFAULT_DUTY_OPTIONS);

  async function loadDutyOptions() {
    const response = await fetch("/api/v1/settings/duty-options", { cache: "no-store" });
    if (!response.ok) return;
    const options = await response.json();
    setDutyOptions(options);
  }

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
    if (result.entitlement?.access?.modules?.includes("delegation")) await loadDutyOptions();
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
    const titles = DUTY_TITLES[category] || [];
    setModal({
      resource: "duties",
      title: `New ${category} duty`,
      item: {
        category,
        title: titles[0] || `${category} duty`,
        owner: preferredOption(dutyOptions.owners, category === "Hot Work" ? "Chief Officer" : "Safety Officer"),
        location: dutyOptions.locations[0] || "",
        status: category === "Hot Work" ? "Pending Master Approval" : "Open",
        severity: category === "Hot Work" ? "Critical" : "Normal",
        due_at: defaultDutyDue(),
        vessel_id: data?.vessels?.[0]?.id || ""
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
  const isEVFuture = tab === "EV Future";
  const isNoOtherMaster = tab === "No Other Master";
  const isSpecialWorkspace = isMaritimeIntel || isCommand || isEVFuture || isNoOtherMaster;
  const canDelegate = tabAllowed(data, "Delegation");
  const canUseAnalytics = Boolean(data?.entitlement?.access?.modules?.includes("analytics"));

  return (
    <div className={`dashboard-shell ${menuOpen ? "menu-open" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-head"><div className="brand"><span className="brand-mark">✦</span><span>NEPTUNE<small>Vessel Command</small></span></div><button className="menu-btn" onClick={() => setMenuOpen(false)}>×</button></div>
        <div className="sidebar-current"><b>{tab}</b><span>{isCommand ? "Fleet trends, alerts, and decision recommendations" : isMaritimeIntel ? "Weather, ocean, ports, bunkering, and rescue intelligence" : isEVFuture ? "Future electric, autonomous, and high-energy vessel development" : isNoOtherMaster ? "Seafarer safety, distress, welfare, tracking, insurance, and family care" : "Your organization workspace"}</span></div>
        {data?.entitlement && <div className="sidebar-current"><b>{data.entitlement.planName}</b><span>{data.entitlement.status === "trialing" ? `${data.entitlement.daysRemaining} trial days remaining` : "Active subscription"}</span></div>}
        {visibleNavGroups.map(([group, items]) => <details className="nav-group" open key={group}><summary>{group}<span>{items.length}</span></summary><div className="nav-grid">{items.map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => chooseTab(item)}>{item}</button>)}</div></details>)}
        {canUseAnalytics && <Link className="btn" style={{ width: "100%", marginTop: 12 }} href="/admin">CRM & Analytics Admin</Link>}
        <Link className="btn gold" style={{ width: "100%", marginTop: 8 }} href="/pricing">Change package</Link>
        <button className="btn danger" style={{ width: "100%", marginTop: 8 }} onClick={logout}>Logout</button>
      </aside>
      <button className="mobile-scrim" onClick={() => setMenuOpen(false)} aria-label="Close menu" />
      <main className="main">
        <header className="topbar"><button className="menu-btn" onClick={() => setMenuOpen(true)}>☰</button><div className="search"><input value={query} onChange={event => setQuery(event.target.value)} placeholder={isMaritimeIntel ? "Use the maritime location search below..." : isCommand ? "Open a module to search organization records..." : isEVFuture ? "Use the program views and accountability tracker below..." : isNoOtherMaster ? "Use the safety, welfare, insurance, and implementation categories below..." : "Search your organization records..."} disabled={isSpecialWorkspace} style={{ background: "transparent", border: 0, outline: 0, width: "100%" }} /></div><button className="profile" onClick={() => chooseTab("Settings")}>FE</button></header>
        <section className={`workspace glass premium ${isMaritimeIntel ? "maritime-workspace" : ""} ${isEVFuture || isNoOtherMaster ? "ev-future-workspace" : ""}`}>
          {!isSpecialWorkspace && <div className="workspace-header"><div><p className="eyebrow">Private Organization Workspace</p><h1>{tab}</h1><p className="muted">Every visible module and metric is limited to the access listed for your purchased package.</p></div><div className="actions">{canDelegate && <><button className="btn gold" onClick={() => quickDuty("Hot Work")}>Delegate hot work</button><button className="btn" onClick={() => quickDuty("Inspection")}>Assign inspection</button></>}{resource && FORM_FIELDS[resource] && <button className="btn" onClick={() => setModal({ resource, title: `New ${tab} record` })}>New record</button>}</div></div>}
          {message && <div className="form-message" style={{ marginTop: 12 }}>{message}</div>}
          {loading || !data ? <p className="lede">Loading your organization decision data...</p> : <>
            {!isSpecialWorkspace && <div className="kpi-grid">{packageKpis.map(card => <div className="kpi" key={`${card.module}-${card.label}`}><span>{card.label}</span><b>{card.value}</b></div>)}</div>}
            {isCommand && <DecisionCommandCenter data={data} openTab={chooseTab} createVessel={() => setModal({ resource: "vessels", title: "Add your first vessel" })} createDuty={() => quickDuty("Inspection")} />}
            {isMaritimeIntel && <MaritimeIntelligence data={data} refresh={load} notify={setMessage} />}
            {isEVFuture && <EVFutureProjects />}
            {isNoOtherMaster && <NoOtherMaster openTab={chooseTab} />}
            {tab === "Settings" && <Settings logout={logout} canDelegate={canDelegate} dutyOptions={dutyOptions} onSaved={options => { setDutyOptions(options); setMessage("Duty setup saved. Hot Work and Inspection forms now use these dropdown choices."); }} />}
            {resource && <ResourceView resource={resource} rows={visible} edit={item => setModal({ resource, item, title: `Edit ${tab} record` })} remove={id => remove(resource, id)} />}
          </>}
        </section>
      </main>
      {modal && <RecordModal modal={modal} dutyOptions={dutyOptions} vessels={data?.vessels || []} close={() => setModal(null)} save={save} />}
    </div>
  );
}

function Settings({ logout, canDelegate, dutyOptions, onSaved }: { logout: () => void; canDelegate: boolean; dutyOptions: DutyOptions; onSaved: (options: DutyOptions) => void }) {
  const [owners, setOwners] = useState((dutyOptions.configuredOwners.length ? dutyOptions.configuredOwners : dutyOptions.owners).join("\n"));
  const [locations, setLocations] = useState((dutyOptions.configuredLocations.length ? dutyOptions.configuredLocations : dutyOptions.locations).join("\n"));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setOwners((dutyOptions.configuredOwners.length ? dutyOptions.configuredOwners : dutyOptions.owners).join("\n"));
    setLocations((dutyOptions.configuredLocations.length ? dutyOptions.configuredLocations : dutyOptions.locations).join("\n"));
  }, [dutyOptions]);

  async function saveDutySetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("");
    const response = await fetch("/api/v1/settings/duty-options", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ owners: splitSetupValues(owners), locations: splitSetupValues(locations) })
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok) {
      setStatus(result.error || "Unable to save duty setup.");
      return;
    }
    setStatus("Saved. These choices now appear in every Hot Work and Inspection form.");
    onSaved(result);
  }

  return <div className="settings-layout">
    {canDelegate && <article className="record duty-setup-card">
      <div className="duty-setup-head"><div><p className="eyebrow">One-Time Duty Setup</p><h3>Reusable owners and work locations</h3><p>Enter this information once. Neptune will reuse it as dropdown choices whenever your team creates Hot Work, Inspection, Safety, Cargo, Navigation, or Maintenance duties.</p></div><span className={`status ${dutyOptions.isConfigured ? "configured" : ""}`}>{dutyOptions.isConfigured ? "Configured" : "Ready to configure"}</span></div>
      <form className="form duty-setup-form" onSubmit={saveDutySetup}>
        <label>Duty owners and shipboard roles<textarea rows={8} value={owners} onChange={event => setOwners(event.target.value)} placeholder="Master&#10;Chief Officer&#10;Safety Officer" /><small>One owner or role per line. Existing duty owners are automatically retained.</small></label>
        <label>Work locations<textarea rows={8} value={locations} onChange={event => setLocations(event.target.value)} placeholder="Bridge&#10;Main Deck&#10;Engine Room" /><small>One shipboard location per line. Existing duty locations are automatically retained.</small></label>
        <div className="duty-setup-actions"><button className="btn gold" disabled={saving}>{saving ? "Saving setup..." : "Save dropdown setup"}</button><span>{status}</span></div>
      </form>
    </article>}
    <div className="record-grid settings-secondary"><article className="record"><p className="eyebrow">Organization</p><h3>Organization profile</h3><p>Manage company profile, fleet defaults, and workspace branding.</p><button className="btn" onClick={() => alert("Organization profile editing will be added to the settings API.")}>Edit profile</button></article><article className="record"><p className="eyebrow">Security</p><h3>Signed sessions</h3><p>HTTP-only session cookies, organization isolation, and protected API routes are active.</p><button className="btn" onClick={() => alert("Connect a verified email domain to activate user invitations.")}>Invite user</button></article><article className="record"><p className="eyebrow">Account</p><h3>Session controls</h3><p>End the current secure operator session.</p><button className="btn danger" onClick={logout}>Logout</button></article></div>
  </div>;
}

function ResourceView({ resource, rows, edit, remove }: { resource: string; rows: any[]; edit: (item: any) => void; remove: (id: string) => void }) {
  if (!rows.length) return <div className="record empty-organization-record"><p className="eyebrow">No organization data</p><h3>No records yet</h3><p>This module is intentionally empty until your team creates its first real record. The command dashboard will update as data is added.</p></div>;
  const columns = Object.keys(rows[0]).filter(key => !["org_id", "created_at", "password_hash"].includes(key)).slice(0, 7);
  return <div className="data-grid"><table><thead><tr>{columns.map(column => <th key={column}>{column.replaceAll("_", " ")}</th>)}<th>Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}>{columns.map(column => <td key={column}>{column === "annual_value" ? `$${Number(row[column] || 0).toLocaleString()}` : String(row[column] ?? "—")}</td>)}<td><div className="actions"><button className="btn" onClick={() => edit(row)}>Edit</button>{resource !== "subscriptions" && <button className="btn danger" onClick={() => remove(row.id)}>Delete</button>}</div></td></tr>)}</tbody></table></div>;
}

function DutyFields({ item, dutyOptions, vessels }: { item?: any; dutyOptions: DutyOptions; vessels: any[] }) {
  const [category, setCategory] = useState(String(item?.category || "Inspection"));
  const titles = DUTY_TITLES[category] || [];
  const selectedTitle = String(item?.title || titles[0] || "");
  const titleOptions = titles.includes(selectedTitle) || !selectedTitle ? titles : [selectedTitle, ...titles];
  const owner = String(item?.owner || preferredOption(dutyOptions.owners, category === "Hot Work" ? "Chief Officer" : "Safety Officer"));
  const location = String(item?.location || dutyOptions.locations[0] || "");

  return <>
    <div className="duty-form-note"><b>Setup-driven form</b><span>Owners and locations come from Settings → One-Time Duty Setup.</span></div>
    {vessels.length > 0 && <label>Vessel<select name="vessel_id" defaultValue={item?.vessel_id || vessels[0]?.id || ""}>{vessels.map(vessel => <option key={vessel.id} value={vessel.id}>{vessel.name}{vessel.imo ? ` · ${vessel.imo}` : ""}</option>)}</select></label>}
    <label>Duty type<select name="category" value={category} onChange={event => setCategory(event.target.value)}>{DUTY_CATEGORIES.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
    <label>Duty title<select name="title" key={`${category}-${selectedTitle}`} defaultValue={selectedTitle}>{titleOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
    <label>Owner<select name="owner" defaultValue={owner}>{dutyOptions.owners.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
    <label>Location<select name="location" defaultValue={location}>{dutyOptions.locations.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
    <label>Status<select name="status" defaultValue={item?.status || (category === "Hot Work" ? "Pending Master Approval" : "Open")}>{DUTY_STATUS.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
    <label>Severity<select name="severity" defaultValue={String(item?.severity || (category === "Hot Work" ? "Critical" : "Normal")).replace(/^./, value => value.toUpperCase())}>{DUTY_SEVERITY.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
    <label>Due<input name="due_at" type="datetime-local" required defaultValue={localDateTime(item?.due_at || defaultDutyDue())} /></label>
  </>;
}

function RecordModal({ modal, close, save, dutyOptions, vessels }: { modal: { resource: string; item?: any; title: string }; close: () => void; save: (event: React.FormEvent<HTMLFormElement>) => void; dutyOptions: DutyOptions; vessels: any[] }) {
  const fields = FORM_FIELDS[modal.resource] || [];
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><section className={`modal glass premium ${modal.resource === "duties" ? "duty-modal" : ""}`}><div className="modal-head"><div><p className="eyebrow">Your Organization Record</p><h2>{modal.title}</h2></div><button className="modal-close" onClick={close}>×</button></div><form className="form" onSubmit={save}>{modal.resource === "duties" ? <DutyFields item={modal.item} dutyOptions={dutyOptions} vessels={vessels} /> : fields.map(field => <label key={field.key}>{field.label}{field.options ? <select name={field.key} required={!field.optional} defaultValue={modal.item?.[field.key] ?? field.options[0]}>{field.options.map(option => <option key={option} value={option}>{option}</option>)}</select> : <input name={field.key} type={field.type || "text"} min={field.key === "readiness" ? 0 : undefined} max={field.key === "readiness" ? 100 : undefined} required={!field.optional} defaultValue={field.type === "datetime-local" ? localDateTime(modal.item?.[field.key]) : modal.item?.[field.key] ?? ""} placeholder={field.placeholder} />}</label>)}<div className="actions"><button className="btn gold">Save record</button><button className="btn" type="button" onClick={close}>Cancel</button></div></form></section></div>;
}
