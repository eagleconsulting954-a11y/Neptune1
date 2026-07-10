"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type DemoRecord = Record<string, any> & { id: string };
type DemoState = {
  vessels: DemoRecord[];
  duties: DemoRecord[];
  workOrders: DemoRecord[];
  certificates: DemoRecord[];
  incidents: DemoRecord[];
  crm: DemoRecord[];
  activity: DemoRecord[];
};

const seed: DemoState = {
  vessels: [
    { id: "v1", name: "MT Atlantic Pioneer", type: "Tanker", status: "En route", readiness: 94, eta: "Santos · 38h", department: "Command" },
    { id: "v2", name: "MV Pacific Meridian", type: "Container", status: "Port preparation", readiness: 88, eta: "Singapore · 4d", department: "Deck" },
    { id: "v3", name: "MT Aurora Spirit", type: "Product tanker", status: "At anchor", readiness: 82, eta: "Houston · Hold", department: "Engineering" }
  ],
  duties: [
    { id: "d1", title: "Hot work permit HW-104", category: "Hot Work", owner: "Chief Officer", location: "Engine workshop", status: "Master approval", severity: "Critical", due: "Today 16:00" },
    { id: "d2", title: "Main deck safety inspection", category: "Inspection", owner: "Bosun", location: "Main deck", status: "Evidence required", severity: "Attention", due: "Today 18:00" },
    { id: "d3", title: "Aux generator inspection", category: "Inspection", owner: "2nd Engineer", location: "Engine room", status: "Open", severity: "Normal", due: "Tomorrow" }
  ],
  workOrders: [
    { id: "w1", title: "Aux generator cooling leak", owner: "Chief Engineer", priority: "High", status: "Parts pending", due: "Tomorrow" },
    { id: "w2", title: "Fire pump pressure test", owner: "3rd Engineer", priority: "Medium", status: "Scheduled", due: "Jul 14" }
  ],
  certificates: [
    { id: "c1", name: "IOPP Certificate", vessel: "MV Pacific Meridian", status: "Expiring", expiry: "Aug 01, 2026", owner: "Captain" },
    { id: "c2", name: "Safety Management Certificate", vessel: "MT Atlantic Pioneer", status: "Current", expiry: "Feb 11, 2027", owner: "DPA" }
  ],
  incidents: [
    { id: "i1", title: "Near miss during stores transfer", vessel: "MT Atlantic Pioneer", severity: "Low", status: "RCA open", owner: "Safety Officer" }
  ],
  crm: [
    { id: "r1", company: "Atlantic Fleet Group", contact: "Maria Santos", stage: "Demo booked", annualValue: 96000, email: "maria@atlanticfleet.com" },
    { id: "r2", company: "HarborBridge Shipping", contact: "David Chen", stage: "Qualified", annualValue: 42000, email: "david@harborbridge.com" },
    { id: "r3", company: "Meridian Marine", contact: "Nadia Rahman", stage: "Proposal", annualValue: 144000, email: "nadia@meridianmarine.com" }
  ],
  activity: [
    { id: "a1", time: "14:11", label: "PTW HW-104 submitted", detail: "Chief Officer sent permit for Master approval" },
    { id: "a2", time: "13:45", label: "Certificate pack validated", detail: "No blocking errors found" },
    { id: "a3", time: "11:20", label: "Critical quote updated", detail: "19 inventory lines matched" },
    { id: "a4", time: "09:05", label: "eORB entry locked", detail: "Chief Engineer countersignature recorded" }
  ]
};

const tabResources: Record<string, keyof DemoState | null> = {
  Command: null,
  Vessels: "vessels",
  Delegation: "duties",
  Maintenance: "workOrders",
  Certificates: "certificates",
  Incidents: "incidents",
  CRM: "crm",
  Analytics: null,
  Activity: "activity"
};

const tour = [
  { tab: "Command", title: "Fleet command", text: "Start with fleet readiness, urgent approvals, operational risk, and the live activity queue." },
  { tab: "Vessels", title: "Vessel CRM", text: "Open vessel accounts, review readiness, status, ETA, and department ownership." },
  { tab: "Delegation", title: "Delegate duties", text: "Assign hot work and inspection duties with owners, location, severity, deadlines, and approval status." },
  { tab: "Maintenance", title: "Engineering control", text: "Track work orders, priorities, due dates, owners, parts, and closeout progress." },
  { tab: "CRM", title: "Commercial CRM", text: "Manage maritime opportunities, pipeline stages, contacts, and annual contract value." },
  { tab: "Analytics", title: "Connected analytics", text: "Neptune converts operating and CRM records into command-level performance signals." }
];

function cloneSeed(): DemoState {
  return JSON.parse(JSON.stringify(seed));
}

export function DemoApp() {
  const [state, setState] = useState<DemoState>(cloneSeed());
  const [tab, setTab] = useState("Command");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{ resource: keyof DemoState; item?: DemoRecord; preset?: Record<string, any> } | null>(null);
  const [detail, setDetail] = useState<DemoRecord | null>(null);
  const [message, setMessage] = useState("Demo mode is isolated from production data. Changes are saved only in this browser.");
  const [tourStep, setTourStep] = useState<number | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("neptune_public_demo");
    if (stored) {
      try { setState(JSON.parse(stored)); } catch { setState(cloneSeed()); }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("neptune_public_demo", JSON.stringify(state));
  }, [state]);

  const averageReadiness = Math.round(state.vessels.reduce((sum, vessel) => sum + Number(vessel.readiness || 0), 0) / Math.max(1, state.vessels.length));
  const pipeline = state.crm.reduce((sum, account) => sum + Number(account.annualValue || 0), 0);
  const critical = state.duties.filter(duty => String(duty.severity).toLowerCase() === "critical").length;
  const resource = tabResources[tab];
  const rows = useMemo(() => {
    if (!resource) return [];
    const needle = query.trim().toLowerCase();
    return state[resource].filter(row => !needle || JSON.stringify(row).toLowerCase().includes(needle));
  }, [state, resource, query]);

  function openTab(next: string) {
    setTab(next);
    setQuery("");
  }

  function resetDemo() {
    setState(cloneSeed());
    setTab("Command");
    setMessage("Demo reset to the original test workspace.");
    window.localStorage.removeItem("neptune_public_demo");
  }

  function startTour() {
    setTourStep(0);
    setTab(tour[0].tab);
  }

  function nextTour() {
    if (tourStep === null) return;
    if (tourStep >= tour.length - 1) {
      setTourStep(null);
      setMessage("Guided tour complete. Continue testing any module.");
      return;
    }
    const next = tourStep + 1;
    setTourStep(next);
    setTab(tour[next].tab);
  }

  function addQuickDuty(category: string) {
    setModal({ resource: "duties", preset: { category, severity: category === "Hot Work" ? "Critical" : "Normal", owner: category === "Hot Work" ? "Chief Officer" : "Safety Officer", status: "Open", due: "Today" } });
  }

  function saveRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal) return;
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const item: DemoRecord = { ...modal.preset, ...modal.item, ...values, id: modal.item?.id || `${modal.resource}_${Date.now()}` };
    for (const key of ["readiness", "annualValue"]) if (key in item) item[key] = Number(item[key] || 0);
    setState(current => ({
      ...current,
      [modal.resource]: modal.item
        ? current[modal.resource].map(row => row.id === item.id ? item : row)
        : [item, ...current[modal.resource]]
    }));
    setModal(null);
    setMessage(modal.item ? "Demo record updated." : "Demo record created successfully.");
  }

  function removeRecord(resourceName: keyof DemoState, id: string) {
    setState(current => ({ ...current, [resourceName]: current[resourceName].filter(row => row.id !== id) }));
    setDetail(null);
    setMessage("Demo record deleted. Use Reset demo to restore the original workspace.");
  }

  return (
    <main className="demo-page">
      <header className="demo-header glass">
        <Link className="brand" href="/"><span className="brand-mark">✦</span><span>NEPTUNE<small>Interactive Product Demo</small></span></Link>
        <div className="demo-header-actions"><span className="demo-badge">Public demo</span><button className="btn" onClick={startTour}>Guided tour</button><button className="btn" onClick={resetDemo}>Reset demo</button><Link className="btn gold" href="/signup">Start trial</Link></div>
      </header>

      <div className="demo-layout">
        <aside className="demo-sidebar glass">
          <p className="eyebrow">Test every module</p>
          <nav>{Object.keys(tabResources).map(item => <button key={item} className={tab === item ? "active" : ""} onClick={() => openTab(item)}><span>{item}</span><small>{item === "Delegation" ? state.duties.length : item === "Vessels" ? state.vessels.length : item === "CRM" ? state.crm.length : "Open"}</small></button>)}</nav>
          <div className="demo-sidebar-note"><b>No signup required</b><span>Add, edit, delete, search, delegate duties, and test analytics.</span></div>
        </aside>

        <section className="demo-workspace">
          <div className="demo-toolbar">
            <div><p className="eyebrow">Interactive Workspace</p><h1>{tab}</h1></div>
            <div className="actions"><button className="btn gold" onClick={() => addQuickDuty("Hot Work")}>Delegate hot work</button><button className="btn" onClick={() => addQuickDuty("Inspection")}>Assign inspection</button>{resource && resource !== "activity" && <button className="btn" onClick={() => setModal({ resource })}>New record</button>}</div>
          </div>

          {message && <div className="demo-message">{message}</div>}
          {tourStep !== null && <div className="tour-card glass"><div><span>Step {tourStep + 1} of {tour.length}</span><h3>{tour[tourStep].title}</h3><p>{tour[tourStep].text}</p></div><div className="actions"><button className="btn" onClick={() => setTourStep(null)}>Exit</button><button className="btn gold" onClick={nextTour}>{tourStep === tour.length - 1 ? "Finish" : "Next module"}</button></div></div>}

          <section className="demo-kpis">
            <Kpi label="Active vessels" value={state.vessels.length} />
            <Kpi label="Fleet readiness" value={`${averageReadiness}%`} />
            <Kpi label="Open duties" value={state.duties.length} />
            <Kpi label="Critical duties" value={critical} />
            <Kpi label="CRM pipeline" value={`$${pipeline.toLocaleString()}`} />
          </section>

          {tab === "Command" && <CommandView state={state} openTab={openTab} setDetail={setDetail} />}
          {tab === "Analytics" && <AnalyticsView state={state} />}
          {resource && <RecordsView resource={resource} rows={rows} query={query} setQuery={setQuery} edit={item => setModal({ resource, item })} detail={setDetail} remove={id => removeRecord(resource, id)} />}
        </section>
      </div>

      {modal && <DemoModal resource={modal.resource} item={modal.item} preset={modal.preset} close={() => setModal(null)} save={saveRecord} />}
      {detail && <DetailPanel item={detail} close={() => setDetail(null)} />}
    </main>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return <article className="demo-kpi glass"><span>{label}</span><b>{value}</b><i /></article>;
}

function CommandView({ state, openTab, setDetail }: { state: DemoState; openTab: (tab: string) => void; setDetail: (item: DemoRecord) => void }) {
  return <div className="demo-command-grid">
    <article className="demo-panel glass premium demo-map-panel"><div className="demo-panel-head"><div><p className="eyebrow">Fleet Position</p><h2>Live command map</h2></div><button className="btn" onClick={() => openTab("Vessels")}>Open vessels</button></div><div className="demo-map">{state.vessels.map((vessel, index) => <button key={vessel.id} style={{left:`${18 + index * 27}%`,top:`${28 + (index % 2) * 34}%`}} onClick={() => setDetail(vessel)}>{vessel.name.replace(/^(MT|MV) /, "")}</button>)}</div></article>
    <article className="demo-panel glass premium"><div className="demo-panel-head"><div><p className="eyebrow">Critical Queue</p><h2>Needs action</h2></div><button className="btn" onClick={() => openTab("Delegation")}>Duty center</button></div><div className="demo-queue">{state.duties.map(duty => <button key={duty.id} onClick={() => setDetail(duty)}><div><b>{duty.title}</b><span>{duty.owner} · {duty.location}</span></div><em>{duty.status}</em></button>)}</div></article>
    <article className="demo-panel glass premium"><div className="demo-panel-head"><div><p className="eyebrow">Recent Activity</p><h2>Audit stream</h2></div><button className="btn" onClick={() => openTab("Activity")}>View all</button></div><div className="demo-activity">{state.activity.slice(0, 4).map(event => <div key={event.id}><b>{event.time}</b><span>{event.label}<small>{event.detail}</small></span></div>)}</div></article>
  </div>;
}

function AnalyticsView({ state }: { state: DemoState }) {
  const pipeline = state.crm.reduce((sum, account) => sum + Number(account.annualValue || 0), 0);
  const stages = state.crm.reduce((acc: Record<string, number>, account) => { acc[account.stage] = (acc[account.stage] || 0) + Number(account.annualValue || 0); return acc; }, {});
  const max = Math.max(...Object.values(stages), 1);
  return <div className="demo-analytics-grid">
    <article className="demo-panel glass premium"><p className="eyebrow">CRM Analytics</p><h2>Pipeline by stage</h2><div className="demo-stage-bars">{Object.entries(stages).map(([name, value]) => <div key={name}><span>{name}</span><div><i style={{width:`${value / max * 100}%`}} /></div><b>${value.toLocaleString()}</b></div>)}</div></article>
    <article className="demo-panel glass premium"><p className="eyebrow">Operations</p><h2>Readiness signals</h2><div className="demo-ring-wrap"><div className="demo-ring" style={{"--score": `${Math.round(state.vessels.reduce((sum, vessel) => sum + vessel.readiness, 0) / state.vessels.length)}%`} as React.CSSProperties}><b>{Math.round(state.vessels.reduce((sum, vessel) => sum + vessel.readiness, 0) / state.vessels.length)}%</b><span>Fleet readiness</span></div><div className="demo-analytics-list"><div><span>Work orders</span><b>{state.workOrders.length}</b></div><div><span>Certificates</span><b>{state.certificates.length}</b></div><div><span>Incidents</span><b>{state.incidents.length}</b></div><div><span>Pipeline</span><b>${pipeline.toLocaleString()}</b></div></div></div></article>
  </div>;
}

function RecordsView({ resource, rows, query, setQuery, edit, detail, remove }: { resource: keyof DemoState; rows: DemoRecord[]; query: string; setQuery: (value: string) => void; edit: (item: DemoRecord) => void; detail: (item: DemoRecord) => void; remove: (id: string) => void }) {
  const columns = rows[0] ? Object.keys(rows[0]).filter(key => key !== "id").slice(0, 6) : [];
  return <article className="demo-panel glass premium"><div className="demo-panel-head"><div><p className="eyebrow">Demo Records</p><h2>{resource.replace(/([A-Z])/g, " $1")}</h2></div><input className="demo-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search records..." /></div>{rows.length ? <div className="data-grid"><table><thead><tr>{columns.map(column => <th key={column}>{column}</th>)}<th>Actions</th></tr></thead><tbody>{rows.map(row => <tr key={row.id} onClick={() => detail(row)}>{columns.map(column => <td key={column}>{column === "annualValue" ? `$${Number(row[column]).toLocaleString()}` : String(row[column] ?? "—")}</td>)}<td onClick={event => event.stopPropagation()}><div className="actions"><button className="btn" onClick={() => edit(row)}>Edit</button><button className="btn danger" onClick={() => remove(row.id)}>Delete</button></div></td></tr>)}</tbody></table></div> : <div className="demo-empty"><h3>No matching records</h3><p>Create a record or reset the demo workspace.</p></div>}</article>;
}

const fields: Record<keyof DemoState, { key: string; label: string; type?: string }[]> = {
  vessels: [{key:"name",label:"Vessel name"},{key:"type",label:"Vessel type"},{key:"status",label:"Status"},{key:"readiness",label:"Readiness %",type:"number"},{key:"eta",label:"ETA"},{key:"department",label:"Department"}],
  duties: [{key:"title",label:"Duty title"},{key:"category",label:"Category"},{key:"owner",label:"Owner"},{key:"location",label:"Location"},{key:"status",label:"Status"},{key:"severity",label:"Severity"},{key:"due",label:"Due"}],
  workOrders: [{key:"title",label:"Work order"},{key:"owner",label:"Owner"},{key:"priority",label:"Priority"},{key:"status",label:"Status"},{key:"due",label:"Due"}],
  certificates: [{key:"name",label:"Certificate"},{key:"vessel",label:"Vessel"},{key:"status",label:"Status"},{key:"expiry",label:"Expiry"},{key:"owner",label:"Owner"}],
  incidents: [{key:"title",label:"Incident"},{key:"vessel",label:"Vessel"},{key:"severity",label:"Severity"},{key:"status",label:"Status"},{key:"owner",label:"Owner"}],
  crm: [{key:"company",label:"Company"},{key:"contact",label:"Contact"},{key:"email",label:"Email",type:"email"},{key:"stage",label:"Stage"},{key:"annualValue",label:"Annual value",type:"number"}],
  activity: [{key:"time",label:"Time"},{key:"label",label:"Event"},{key:"detail",label:"Details"}]
};

function DemoModal({ resource, item, preset, close, save }: { resource: keyof DemoState; item?: DemoRecord; preset?: Record<string, any>; close: () => void; save: (event: React.FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><section className="modal glass premium"><div className="modal-head"><div><p className="eyebrow">Interactive Demo</p><h2>{item ? "Edit record" : "Create record"}</h2></div><button className="modal-close" onClick={close}>×</button></div><form className="form" onSubmit={save}>{fields[resource].map(field => <label key={field.key}>{field.label}<input name={field.key} type={field.type || "text"} required defaultValue={item?.[field.key] ?? preset?.[field.key] ?? ""} /></label>)}<div className="actions"><button className="btn gold">Save demo record</button><button className="btn" type="button" onClick={close}>Cancel</button></div></form></section></div>;
}

function DetailPanel({ item, close }: { item: DemoRecord; close: () => void }) {
  return <div className="demo-detail-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><aside className="demo-detail glass premium"><button className="modal-close" onClick={close}>×</button><p className="eyebrow">Record Detail</p><h2>{item.title || item.name || item.company || item.label}</h2><div className="demo-detail-fields">{Object.entries(item).filter(([key]) => key !== "id").map(([key,value]) => <div key={key}><span>{key.replace(/([A-Z])/g," $1")}</span><b>{key === "annualValue" ? `$${Number(value).toLocaleString()}` : String(value)}</b></div>)}</div><button className="btn gold" onClick={close}>Done</button></aside></div>;
}
