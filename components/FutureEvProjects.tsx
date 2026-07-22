"use client";

import { useEffect, useMemo, useState } from "react";

type Project = Record<string, any>;
type Section = "overview" | "technical" | "commercial" | "regulatory" | "accountability";

const SHIP_TYPES = [
  { type: "e-PCTC / e-Container", risk: "Ship battery + cargo battery creates a double fire load.", design: "Double Battery Hull; treat battery rooms like LNG tanks." },
  { type: "MASS PCTC", risk: "No crew available to cool a thermal event for 48 hours.", design: "Autonomous suppression, auto-jettison, and shore command." },
  { type: "Hydrogen + Battery Hybrid", risk: "Battery fire combined with an H₂ leak can create an explosion.", design: "A60 separation, gas-tight boundaries, inert gas, and separate vent masts." }
];

const EV_READY_REQUIREMENTS = [
  ["Energy zoning", "Maximum 50 MWh per fire zone, with A60 separation and water mist between zones."],
  ["Autonomous suppression", "AI thermal detection triggers blanket deployment and automatic flooding within three minutes."],
  ["Battery runoff", "Holding capacity equal to 110% of expected runoff, with zero discharge at sea."],
  ["Remote kill", "Shore control can isolate power to any EV or ship-battery module."],
  ["Digital twin", "Every battery cell reports state of charge, temperature, and voltage to the cloud every 60 seconds."],
  ["Jettison", "Containerized EVs use fireproof cassettes with hydraulic push-ramps." ]
];

const SURVIVAL_TIMELINE = [
  ["T+0 min", "AI confirms a temperature rise greater than 5°C per minute and alerts the Shore Control Center."],
  ["T+5 min", "Automatically isolate the zone, begin cooling, and deploy a fire blanket."],
  ["T+30 min", "If temperature exceeds 200°C, automatically jettison the cassette or container."],
  ["T+2 hr", "If the fire spreads, automatically flood the compartment."],
  ["T+48 hr", "Divert to the nearest pre-contracted EV Emergency Port." ]
];

const CHARTER_CLAUSE = [
  ["Battery as fuel", "A ship battery above 5 MWh is treated as dangerous cargo; charterers cover battery degradation and thermal-management costs."],
  ["Data liability", "Charterers are liable for incorrect state-of-charge data; Digital Twin records are treated as legal evidence."],
  ["Autonomous decision", "Master or shore control may jettison, flood, or scrap cargo to save the vessel without waiting for P&I approval."],
  ["New peril", "Battery Thermal Runaway is listed separately from Fire in Hull & Machinery and P&I cover."],
  ["Port costs", "Charterers pay EV Emergency Port disposal and hazardous-material charges." ]
];

const IMO_PROPOSAL = [
  "Define a High-Energy Vessel as a ship with more than 1 MWh of ship battery or more than 50 MWh of cargo battery.",
  "Require an Energy Passport for every EV containing state of charge, health, damage status, and a QR code.",
  "Certify Shore Control Centers for MASS operations in a manner comparable to VTS.",
  "Establish Safe Haven ports with battery-fire and hazardous-material capability every 1,000 nautical miles.",
  "Target interim guidance in 2026 and a mandatory code in 2028."
];

const FLAG_REQUIREMENTS = [
  "Hold EV-READY or BATTERY POWERED notation from an IACS class society.",
  "Submit an EV Management Plan to the Administration before the first voyage.",
  "Conduct an annual Battery Fire Drill with video evidence.",
  "Report any thermal event above 60°C to the Flag within 24 hours."
];

const PROJECT_TEMPLATES = [
  { title: "Shipyard Spec for e-PCTC", workstream: "Shipyard Spec", vessel_concept: "e-PCTC / e-Container", target_year: 2030, next_gate: "Define owner, class partner, design basis, and approval gate." },
  { title: "MASS Shore Control SOP", workstream: "MASS Shore Control SOP", vessel_concept: "MASS PCTC", target_year: 2030, next_gate: "Assign shore-control owner and validate the 48-hour survival protocol." },
  { title: "IMO Proposal Deck", workstream: "IMO Proposal Deck", vessel_concept: "High-Energy Vessel / MASS", target_year: 2028, next_gate: "Assign regulatory owner and prepare evidence for CCC and MASS working groups." }
];

const WORKSTREAMS = ["Shipyard Spec", "MASS Shore Control SOP", "IMO Proposal Deck", "Commercial & Insurance", "Flag State", "Emergency Port Network", "Digital Twin", "Other"];
const STATUSES = ["Not started", "Discovery", "In design", "Class review", "Pilot", "Blocked", "Approved", "Complete"];

function blankProject(template?: Record<string, any>) {
  return {
    title: template?.title || "",
    workstream: template?.workstream || "Shipyard Spec",
    vessel_concept: template?.vessel_concept || "",
    owner: "",
    accountable_executive: "",
    status: "Not started",
    target_year: template?.target_year || 2030,
    progress: 0,
    next_gate: template?.next_gate || "",
    due_at: "",
    evidence_url: "",
    blocker: "",
    notes: ""
  };
}

function statusClass(status: string) {
  return String(status || "not-started").toLowerCase().replaceAll(" ", "-");
}

export function FutureEvProjects() {
  const [section, setSection] = useState<Section>("overview");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Project | null>(null);

  async function loadProjects() {
    setLoading(true);
    const response = await fetch("/api/v1/ev-projects", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setMessage(result.error || "Unable to load Future EV projects.");
      return;
    }
    setProjects(result.projects || []);
  }

  useEffect(() => { void loadProjects(); }, []);

  const summary = useMemo(() => ({
    total: projects.length,
    blocked: projects.filter(project => project.status === "Blocked").length,
    complete: projects.filter(project => project.status === "Complete").length,
    average: projects.length ? Math.round(projects.reduce((sum, project) => sum + Number(project.progress || 0), 0) / projects.length) : 0
  }), [projects]);

  async function saveProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const form = new FormData(event.currentTarget);
    const body = { ...editing, ...Object.fromEntries(form.entries()), progress: Number(form.get("progress") || 0), target_year: Number(form.get("target_year") || 2030) };
    const response = await fetch("/api/v1/ev-projects", {
      method: editing.id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || "Unable to save the project.");
      return;
    }
    setEditing(null);
    setMessage(editing.id ? "Future EV project updated." : "Future EV project created with accountable ownership.");
    await loadProjects();
  }

  async function removeProject(id: string) {
    if (!window.confirm("Delete this Future EV project?")) return;
    const response = await fetch(`/api/v1/ev-projects?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || "Unable to delete the project.");
      return;
    }
    setMessage("Future EV project deleted.");
    await loadProjects();
  }

  return <div className="ev-future-workspace">
    <section className="ev-future-hero">
      <div>
        <p className="eyebrow">Future Maritime EV Risk · Projects 2026–2035</p>
        <h2>Ships powered by batteries, carrying batteries, with no crew on board.</h2>
        <p>This planning workspace converts the Future Maritime EV Risk Management Plan into technical, commercial, regulatory, and accountable development workstreams.</p>
      </div>
      <div className="ev-energy-orbit" aria-hidden="true"><span>EV</span><i /><b>2035</b></div>
    </section>

    <div className="ev-planning-warning"><b>Future-planning framework</b><span>The thresholds, notations, clauses, timelines, and operating protocols shown here are proposed project requirements, not a statement of current mandatory law. Validate them with class, Flag, IMO, insurers, ports, and legal counsel before operational use.</span></div>

    <nav className="ev-subtabs" aria-label="Future EV vessel sections">
      {(["overview", "technical", "commercial", "regulatory", "accountability"] as Section[]).map(item => <button key={item} className={section === item ? "active" : ""} onClick={() => setSection(item)}>{item === "accountability" ? "Projects & Accountability" : item}</button>)}
    </nav>

    {message && <div className="form-message">{message}</div>}

    {section === "overview" && <>
      <section className="ev-shift-grid">
        <article><span>01</span><h3>From ship to power plant</h3><p>A future PCTC may carry more stored battery energy than a small town. Vessel design must use power-plant thinking rather than parking-garage assumptions.</p></article>
        <article><span>02</span><h3>From crew to data</h3><p>On MASS vessels, algorithms and shore teams become the operating crew. The critical capability shifts from hoses to validated data and remote action.</p></article>
        <article><span>03</span><h3>From cargo to hazard</h3><p>EVs become mobile energy storage. That changes stowage, liability, insurance, emergency response, and evidence requirements.</p></article>
      </section>
      <section className="ev-risk-table panel">
        <div className="ev-section-head"><div><p className="eyebrow">Future Vessel Concepts</p><h3>New ship types and their new failure modes</h3></div><span className="status">2030 design horizon</span></div>
        <div className="ev-table"><div className="ev-table-row heading"><b>Ship type</b><b>New risk</b><b>Design response</b></div>{SHIP_TYPES.map(row => <div className="ev-table-row" key={row.type}><strong>{row.type}</strong><span>{row.risk}</span><span>{row.design}</span></div>)}</div>
      </section>
      <section className="ev-program-requirements panel">
        <div><p className="eyebrow">Development Program</p><h3>Three required deliverables</h3><p>The source plan calls for clear ownership and accountability across technical, operational, and regulatory development.</p></div>
        <div className="ev-template-grid">{PROJECT_TEMPLATES.map(template => <button key={template.title} onClick={() => { setEditing(blankProject(template)); setSection("accountability"); }}><span>Start project</span><b>{template.title}</b><small>{template.next_gate}</small></button>)}</div>
      </section>
    </>}

    {section === "technical" && <>
      <section className="ev-two-column">
        <article className="panel ev-spec-panel"><div className="ev-section-head"><div><p className="eyebrow">EV-Ready 2030</p><h3>Battery-first shipyard specification</h3></div><span className="status">Target: DNV Battery Power + IMO MASS Level 3</span></div><div className="ev-requirement-list">{EV_READY_REQUIREMENTS.map(([title, detail], index) => <div key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{title}</b><p>{detail}</p></div></div>)}</div></article>
        <article className="panel ev-protocol-panel"><div className="ev-section-head"><div><p className="eyebrow">MASS Operations</p><h3>48-hour survival protocol</h3></div><span className="status">Human role: monitor only</span></div><div className="ev-timeline">{SURVIVAL_TIMELINE.map(([time, action]) => <div key={time}><b>{time}</b><span>{action}</span></div>)}</div><div className="ev-hf-rule"><b>Boarding condition</b><span>No boarding until hydrogen-fluoride concentration is below 10 ppm.</span></div></article>
      </section>
      <section className="ev-risk-table panel"><div className="ev-section-head"><div><p className="eyebrow">Design Risk Matrix</p><h3>Battery-first vessel architecture</h3></div></div><div className="ev-table"><div className="ev-table-row heading"><b>Ship type</b><b>Primary risk</b><b>Required architecture</b></div>{SHIP_TYPES.map(row => <div className="ev-table-row" key={row.type}><strong>{row.type}</strong><span>{row.risk}</span><span>{row.design}</span></div>)}</div></section>
    </>}

    {section === "commercial" && <section className="ev-two-column">
      <article className="panel"><div className="ev-section-head"><div><p className="eyebrow">Battery Ship Clause 2030</p><h3>Future charter-party allocation</h3></div></div><div className="ev-clause-list">{CHARTER_CLAUSE.map(([title, detail], index) => <div key={title}><span>{index + 1}</span><div><b>{title}</b><p>{detail}</p></div></div>)}</div></article>
      <article className="panel ev-submission"><p className="eyebrow">Insurance Submission Script</p><h3>e-PCTC · 10 MWh ship battery · 4,000 EVs</h3><div className="ev-submission-spec"><span>Ship battery</span><b>10 MWh LFP · liquid cooled · A60 room</b><span>Cargo energy</span><b>4,000 EVs × 60 kWh = 240 MWh</b><span>Controls</span><b>AI monitoring · auto-jettison · 48-hour cooling</b></div><h4>Requested cover</h4><ul><li>Hull & Machinery extension for Battery Thermal Runaway</li><li>P&I extension for Battery Pollution</li><li>Cyber cover for a Shore Control Center compromise</li></ul><div className="ev-evidence"><b>Evidence package</b><span>FMEA · Class approval · Emergency Response Plan</span></div></article>
    </section>}

    {section === "regulatory" && <section className="ev-two-column">
      <article className="panel"><div className="ev-section-head"><div><p className="eyebrow">MASS + EV Code Proposal</p><h3>Carriage of high-energy batteries at sea</h3></div><span className="status">Proposed framework</span></div><ol className="ev-numbered">{IMO_PROPOSAL.map(item => <li key={item}>{item}</li>)}</ol><div className="ev-regulatory-impact">Without an accepted framework, the source plan anticipates insurance withdrawal and interruption of trade.</div></article>
      <article className="panel"><div className="ev-section-head"><div><p className="eyebrow">Flag State Circular</p><h3>EV and MASS operations</h3></div><span className="status">Circular template</span></div><ol className="ev-numbered">{FLAG_REQUIREMENTS.map(item => <li key={item}>{item}</li>)}</ol><div className="ev-detention"><b>Proposed enforcement</b><span>Non-compliance may result in detention under the proposed circular.</span></div></article>
    </section>}

    {section === "accountability" && <>
      <section className="ev-accountability-summary">
        <article><span>Projects</span><b>{summary.total}</b></article><article><span>Average progress</span><b>{summary.average}%</b></article><article className={summary.blocked ? "critical" : ""}><span>Blocked</span><b>{summary.blocked}</b></article><article><span>Complete</span><b>{summary.complete}</b></article>
      </section>
      <section className="ev-project-toolbar"><div><p className="eyebrow">Demanding Accountability</p><h3>Every project needs an owner, executive, gate, evidence, and deadline.</h3></div><button className="btn gold" onClick={() => setEditing(blankProject())}>New EV project</button></section>
      <div className="ev-template-strip">{PROJECT_TEMPLATES.map(template => <button key={template.title} onClick={() => setEditing(blankProject(template))}>+ {template.title}</button>)}</div>
      {loading ? <div className="decision-empty"><b>Loading EV development projects...</b></div> : projects.length ? <section className="ev-project-grid">{projects.map(project => <article className={`ev-project-card ${statusClass(project.status)}`} key={project.id}><div className="ev-project-top"><span className="status">{project.status}</span><b>{project.target_year}</b></div><p className="eyebrow">{project.workstream}</p><h3>{project.title}</h3><p>{project.vessel_concept || "Future EV vessel program"}</p><div className="ev-progress"><span style={{ width: `${Number(project.progress || 0)}%` }} /><b>{project.progress || 0}%</b></div><dl><div><dt>Responsible owner</dt><dd>{project.owner || "Unassigned"}</dd></div><div><dt>Accountable executive</dt><dd>{project.accountable_executive || "Unassigned"}</dd></div><div><dt>Next gate</dt><dd>{project.next_gate || "Not defined"}</dd></div><div><dt>Due</dt><dd>{project.due_at || "Not scheduled"}</dd></div></dl>{project.blocker && <div className="ev-blocker"><b>Blocker</b><span>{project.blocker}</span></div>}<div className="actions"><button className="btn" onClick={() => setEditing(project)}>Edit</button><button className="btn danger" onClick={() => removeProject(project.id)}>Delete</button></div></article>)}</section> : <div className="decision-empty"><b>No accountable EV projects yet</b><p>Start one of the three required development projects and assign a responsible owner before saving.</p></div>}
    </>}

    {editing && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null); }}><section className="modal glass premium ev-project-modal"><div className="modal-head"><div><p className="eyebrow">Future EV Development Program</p><h2>{editing.id ? "Update accountable project" : "Create accountable project"}</h2></div><button className="modal-close" onClick={() => setEditing(null)}>×</button></div><form className="form ev-project-form" onSubmit={saveProject}>
      <label>Project title<input name="title" required defaultValue={editing.title || ""} /></label>
      <label>Workstream<select name="workstream" defaultValue={editing.workstream || WORKSTREAMS[0]}>{WORKSTREAMS.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Vessel concept<input name="vessel_concept" defaultValue={editing.vessel_concept || ""} placeholder="e-PCTC / MASS / Hydrogen hybrid" /></label>
      <label>Responsible owner<input name="owner" required defaultValue={editing.owner || ""} placeholder="Named individual or function" /></label>
      <label>Accountable executive<input name="accountable_executive" defaultValue={editing.accountable_executive || ""} placeholder="Executive sponsor" /></label>
      <label>Status<select name="status" defaultValue={editing.status || STATUSES[0]}>{STATUSES.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Target year<input name="target_year" type="number" min={2026} max={2035} required defaultValue={editing.target_year || 2030} /></label>
      <label>Progress %<input name="progress" type="number" min={0} max={100} required defaultValue={editing.progress || 0} /></label>
      <label>Next decision gate<input name="next_gate" defaultValue={editing.next_gate || ""} placeholder="Class review, pilot approval, submission..." /></label>
      <label>Due date<input name="due_at" type="date" defaultValue={editing.due_at ? String(editing.due_at).slice(0, 10) : ""} /></label>
      <label className="full">Evidence URL<input name="evidence_url" type="url" defaultValue={editing.evidence_url || ""} placeholder="FMEA, approval letter, test report, proposal deck..." /></label>
      <label className="full">Current blocker<textarea name="blocker" rows={3} defaultValue={editing.blocker || ""} /></label>
      <label className="full">Program notes<textarea name="notes" rows={5} defaultValue={editing.notes || ""} /></label>
      <div className="actions full"><button className="btn gold">Save project</button><button type="button" className="btn" onClick={() => setEditing(null)}>Cancel</button></div>
    </form></section></div>}
  </div>;
}
