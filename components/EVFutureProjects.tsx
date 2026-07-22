"use client";

import { useEffect, useMemo, useState } from "react";

const WORKSTREAMS = ["Shipyard Spec", "MASS Shore Control SOP", "IMO Proposal Deck", "Commercial & Insurance", "Flag State", "Emergency Port Network", "Digital Twin", "Other"];
const STATUSES = ["Not started", "Discovery", "In design", "Class review", "Pilot", "Blocked", "Approved", "Complete"];
const VESSEL_CONCEPTS = ["e-PCTC / e-Container", "MASS PCTC", "Hydrogen + Battery Hybrid", "Battery-powered feeder", "Autonomous battery carrier", "Other"];

const DESIGN_REQUIREMENTS = [
  ["Energy zoning", "Maximum 50 MWh per fire zone with A60 separation and water mist between zones."],
  ["Autonomous suppression", "AI thermal detection, automated blanket deployment, and automated flooding within three minutes."],
  ["Battery runoff", "Holding capacity equal to 110% of expected firefighting runoff with zero discharge at sea."],
  ["Remote kill", "Shore control can isolate any EV or ship-battery module."],
  ["Digital twin", "Cell-level state of charge, temperature, and voltage reporting to shore every 60 seconds."],
  ["Jettison capability", "Fireproof EV cassettes or containers with engineered hydraulic removal capability."]
];

const SURVIVAL_PROTOCOL = [
  ["T+0 min", "AI confirms temperature rise above 5°C per minute and alerts the Shore Control Center."],
  ["T+5 min", "Automatically isolate the zone, start cooling, and deploy the fire blanket."],
  ["T+30 min", "If temperature exceeds 200°C, initiate the approved jettison decision sequence."],
  ["T+2 hr", "If propagation continues, flood the approved compartment or fire zone."],
  ["T+48 hr", "Divert to a pre-contracted EV Emergency Port with battery-fire and hazardous-material capability."],
  ["Human role", "Remote monitoring and decision authority. No boarding until the approved gas-entry threshold is achieved."]
];

const COMMERCIAL_CLAUSES = [
  "Treat ship batteries above the agreed energy threshold as a separately managed dangerous-energy exposure.",
  "Assign liability for inaccurate state-of-charge, battery-health, and damage data.",
  "Preserve Master or Shore Control authority to jettison, flood, isolate, or sacrifice cargo to save life and vessel.",
  "List battery thermal runaway separately from conventional fire in hull, machinery, cargo, pollution, and P&I discussions.",
  "Allocate EV Emergency Port disposal, hazardous-material, towage, and remediation costs."
];

const REGULATORY_PROPOSAL = [
  "Define a high-energy vessel using agreed ship-battery and cargo-battery thresholds.",
  "Require an Energy Passport for each EV covering state of charge, health, and damage status.",
  "Certify Shore Control Centers to a standard comparable with critical maritime traffic services.",
  "Develop a network of safe-haven ports with battery-fire and hazardous-material capability.",
  "Create interim guidance, pilot reporting, and a path toward a mandatory code."
];

const SOFTWARE_WORKFLOWS = [
  {
    module: "Vessels + Digital Twin",
    title: "Establish the energy baseline",
    description: "Create an owned data-model workstream for ship-battery capacity, cargo battery exposure, chemistry, cooling, fire zones, remote isolation, and cell-level telemetry.",
    workstream: "Digital Twin",
    projectTitle: "Future EV Vessel Energy Baseline and Digital Twin"
  },
  {
    module: "Certificates",
    title: "Control class and flag evidence",
    description: "Track the design approvals, class notation, EV Management Plan, annual drill evidence, and regulatory submissions required for the vessel concept.",
    workstream: "Flag State",
    projectTitle: "EV Class, Flag, and Management Plan Evidence Register"
  },
  {
    module: "Incidents + Shore Control",
    title: "Prepare thermal-event response",
    description: "Turn the 48-hour survival sequence into an accountable SOP covering detection, isolation, cooling, jettison authority, flooding, diversion, and safe re-entry.",
    workstream: "MASS Shore Control SOP",
    projectTitle: "48-Hour MASS Thermal Runaway Response and Evidence Workflow"
  },
  {
    module: "Maritime Intelligence",
    title: "Build the emergency-port network",
    description: "Develop and validate a route-aware network of ports with battery-fire, hazardous-material, towage, disposal, rescue, and shore-support capability.",
    workstream: "Emergency Port Network",
    projectTitle: "EV Emergency Port and Safe-Haven Network"
  },
  {
    module: "Commercial + Insurance",
    title: "Allocate future loss and liability",
    description: "Create the charter-party, insurance, pollution, cyber, data-liability, and emergency-port cost package supported by FMEA and class evidence.",
    workstream: "Commercial & Insurance",
    projectTitle: "Battery Ship Clause and Future Risk Submission Package"
  },
  {
    module: "Accountability",
    title: "Assign every decision and deadline",
    description: "Use Neptune project records to name the responsible owner, accountable executive, next approval gate, evidence URL, blocker, progress, and due date.",
    workstream: "Shipyard Spec",
    projectTitle: "Future EV Development Program Governance"
  }
];

type Project = Record<string, any>;

type ProjectForm = {
  title: string;
  workstream: string;
  vesselConcept: string;
  owner: string;
  accountableExecutive: string;
  status: string;
  targetYear: number;
  progress: number;
  nextGate: string;
  dueAt: string;
  evidenceUrl: string;
  blocker: string;
  notes: string;
};

const EMPTY_FORM: ProjectForm = {
  title: "",
  workstream: "Shipyard Spec",
  vesselConcept: "e-PCTC / e-Container",
  owner: "",
  accountableExecutive: "",
  status: "Not started",
  targetYear: 2030,
  progress: 0,
  nextGate: "",
  dueAt: "",
  evidenceUrl: "",
  blocker: "",
  notes: ""
};

function projectForm(project?: Project): ProjectForm {
  if (!project) return EMPTY_FORM;
  return {
    title: String(project.title || ""),
    workstream: String(project.workstream || "Shipyard Spec"),
    vesselConcept: String(project.vessel_concept || "e-PCTC / e-Container"),
    owner: String(project.owner || ""),
    accountableExecutive: String(project.accountable_executive || ""),
    status: String(project.status || "Not started"),
    targetYear: Number(project.target_year || 2030),
    progress: Number(project.progress || 0),
    nextGate: String(project.next_gate || ""),
    dueAt: project.due_at ? String(project.due_at).slice(0, 10) : "",
    evidenceUrl: String(project.evidence_url || ""),
    blocker: String(project.blocker || ""),
    notes: String(project.notes || "")
  };
}

function statusClass(status: string) {
  return status.toLowerCase().replaceAll(" ", "-");
}

export function EVFutureProjects() {
  const [view, setView] = useState("Program");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Project | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const response = await fetch("/api/v1/ev-projects", { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setMessage(result.error || "Unable to load EV future projects.");
      return;
    }
    setProjects(result.projects || []);
  }

  useEffect(() => { void load(); }, []);

  function openNew(workstream = "Shipyard Spec", title = "") {
    setEditing(null);
    setForm({ ...EMPTY_FORM, workstream, title });
    setShowForm(true);
    setMessage("");
  }

  function openEdit(project: Project) {
    setEditing(project);
    setForm(projectForm(project));
    setShowForm(true);
    setMessage("");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const response = await fetch("/api/v1/ev-projects", {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, id: editing?.id })
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setMessage(result.error || "Unable to save the EV project.");
      return;
    }
    setShowForm(false);
    setEditing(null);
    setMessage(editing ? "Project accountability record updated." : "EV future project created.");
    await load();
  }

  async function remove(project: Project) {
    if (!window.confirm(`Delete ${project.title}?`)) return;
    const response = await fetch(`/api/v1/ev-projects?id=${encodeURIComponent(project.id)}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error || "Unable to delete the project.");
      return;
    }
    setMessage("Project deleted.");
    await load();
  }

  const summary = useMemo(() => {
    const active = projects.filter(project => !["Complete", "Approved"].includes(project.status)).length;
    const blocked = projects.filter(project => project.status === "Blocked").length;
    const average = projects.length ? Math.round(projects.reduce((sum, project) => sum + Number(project.progress || 0), 0) / projects.length) : 0;
    const dueSoon = projects.filter(project => {
      if (!project.due_at || ["Complete", "Approved"].includes(project.status)) return false;
      const days = Math.ceil((new Date(project.due_at).getTime() - Date.now()) / 86_400_000);
      return days <= 30;
    }).length;
    return { active, blocked, average, dueSoon };
  }, [projects]);

  return <div className="ev-future-shell">
    <section className="ev-future-hero">
      <div>
        <p className="eyebrow">Projects 2026–2035</p>
        <h1>Future Maritime EV Risk</h1>
        <p>The planning problem is not simply more electric vehicles. It is vessels powered by batteries, carrying battery cargo, operating with reduced or no crew, and relying on remote decision authority.</p>
      </div>
      <div className="ev-energy-orbit" aria-hidden="true"><span>SHIP</span><span>CARGO</span><span>SHORE</span><b>EV</b></div>
    </section>

    <div className="ev-warning-banner"><b>Development framework—not adopted regulation.</b><span>Thresholds, response timings, notations, clauses, and regulatory targets must be validated with class, flag, legal counsel, insurers, shipyards, fire specialists, and port authorities before operational use.</span></div>

    <nav className="ev-tabs">{["Program", "Technical", "Commercial", "Regulatory", "Software Use", "Accountability"].map(item => <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>{item}</button>)}</nav>

    {message && <div className="form-message">{message}</div>}

    {view === "Program" && <>
      <section className="ev-shift-grid">
        <article><span>01</span><h3>From ship to power plant</h3><p>Design high-energy vessels as controlled energy systems, not parking decks with added batteries.</p></article>
        <article><span>02</span><h3>From crew to data</h3><p>On MASS vessels, algorithms and shore teams become the operational response system.</p></article>
        <article><span>03</span><h3>From cargo to hazard</h3><p>EVs become mobile energy storage, changing stowage, liability, evidence, and insurance.</p></article>
      </section>
      <section className="ev-concept-grid">
        <article><p className="eyebrow">e-PCTC / e-Container</p><h3>Double battery fire load</h3><p>Ship battery plus EV cargo increases total energy exposure.</p><b>Design direction</b><span>Double Battery Hull concept and battery rooms managed with LNG-style separation discipline.</span></article>
        <article><p className="eyebrow">MASS PCTC</p><h3>No crew cooling for 48 hours</h3><p>Response must be automated, remotely governed, and survivable without onboard intervention.</p><b>Design direction</b><span>Autonomous suppression, engineered jettison, and certified shore command.</span></article>
        <article><p className="eyebrow">Hydrogen + Battery Hybrid</p><h3>Thermal event plus gas leak</h3><p>Battery fire and hydrogen release create a compound explosion scenario.</p><b>Design direction</b><span>A60 separation, gas-tight boundaries, inerting, and independent vent masts.</span></article>
      </section>
      <section className="ev-deliverables">
        <div><p className="eyebrow">Required Development Program</p><h2>Three controlled deliverables</h2><p>Each deliverable needs a named owner, executive accountability, evidence, due date, design gate, and independent validation.</p></div>
        <div className="ev-deliverable-list">
          <button onClick={() => openNew("Shipyard Spec", "EV-READY 2030 e-PCTC Shipyard Specification")}><b>1. Shipyard Spec</b><span>Design basis, energy zoning, suppression, runoff, remote kill, digital twin, and jettison requirements.</span></button>
          <button onClick={() => openNew("MASS Shore Control SOP", "48-Hour MASS Battery Survival and Shore Control SOP")}><b>2. MASS Shore Control SOP</b><span>Detection, isolation, cooling, escalation, jettison, flooding, diversion, and re-entry authority.</span></button>
          <button onClick={() => openNew("IMO Proposal Deck", "MASS + EV High-Energy Battery Code Proposal Deck")}><b>3. IMO Proposal Deck</b><span>Definitions, Energy Passports, Shore Control certification, safe-haven ports, reporting, and implementation path.</span></button>
        </div>
      </section>
    </>}

    {view === "Technical" && <div className="ev-section-stack">
      <section className="ev-panel"><div className="ev-panel-head"><div><p className="eyebrow">EV-READY 2030</p><h2>Battery-first vessel specification</h2></div><button className="btn gold" onClick={() => openNew("Shipyard Spec", "EV-READY 2030 Vessel Specification")}>Create spec project</button></div><div className="ev-requirement-grid">{DESIGN_REQUIREMENTS.map(([title, description], index) => <article key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{title}</b><p>{description}</p></div></article>)}</div><p className="ev-target">Planning target: DNV Battery Power plus the applicable future IMO MASS framework, subject to class and flag confirmation.</p></section>
      <section className="ev-panel"><div className="ev-panel-head"><div><p className="eyebrow">48-Hour Survival Protocol</p><h2>Remote escalation sequence</h2></div><button className="btn" onClick={() => openNew("MASS Shore Control SOP", "48-Hour MASS Battery Survival Protocol")}>Create SOP project</button></div><div className="ev-timeline">{SURVIVAL_PROTOCOL.map(([time, action]) => <article key={time}><b>{time}</b><span>{action}</span></article>)}</div></section>
    </div>}

    {view === "Commercial" && <div className="ev-section-stack">
      <section className="ev-panel"><div className="ev-panel-head"><div><p className="eyebrow">Battery & EV Cargo Clause 2030</p><h2>Allocate the future loss</h2></div><button className="btn gold" onClick={() => openNew("Commercial & Insurance", "Battery Ship Clause 2030 Development")}>Create contract project</button></div><div className="ev-numbered-list">{COMMERCIAL_CLAUSES.map((item, index) => <article key={item}><span>{index + 1}</span><p>{item}</p></article>)}</div></section>
      <section className="ev-panel ev-script"><p className="eyebrow">Insurance Submission Template</p><h3>Risk submission: e-PCTC with ship battery and EV cargo</h3><pre>{`Vessel specification
• Ship battery chemistry, capacity, cooling, and fire boundary
• EV count, average battery size, and total cargo energy
• AI monitoring, automated suppression, jettison, and 48-hour cooling

Requested cover extensions
1. Battery Thermal Runaway — Hull & Machinery
2. Battery Pollution — P&I and environmental response
3. Shore Control Center cyber compromise

Required evidence
FMEA · Class approval · Emergency Response Plan · Data architecture · Port contracts`}</pre></section>
    </div>}

    {view === "Regulatory" && <div className="ev-section-stack">
      <section className="ev-panel"><div className="ev-panel-head"><div><p className="eyebrow">MASS + EV Code Proposal</p><h2>Build the regulatory case</h2></div><button className="btn gold" onClick={() => openNew("IMO Proposal Deck", "High-Energy Batteries at Sea IMO Proposal")}>Create proposal project</button></div><div className="ev-numbered-list">{REGULATORY_PROPOSAL.map((item, index) => <article key={item}><span>{index + 1}</span><p>{item}</p></article>)}</div></section>
      <section className="ev-panel"><div className="ev-panel-head"><div><p className="eyebrow">Flag State Circular Framework</p><h2>Operational controls for EV and MASS vessels</h2></div><button className="btn" onClick={() => openNew("Flag State", "EV and MASS Flag State Circular Development")}>Create circular project</button></div><div className="ev-check-list"><span>□ Require an applicable EV-ready or battery-powered class notation.</span><span>□ Submit an EV Management Plan before the first voyage.</span><span>□ Conduct an annual battery-fire drill with retained evidence.</span><span>□ Report thermal events above the administration’s defined threshold.</span><span>□ Establish detention, restriction, or corrective-action consequences for non-compliance.</span></div></section>
    </div>}

    {view === "Software Use" && <div className="ev-section-stack">
      <section className="ev-panel">
        <div className="ev-panel-head"><div><p className="eyebrow">Neptune Operational Use</p><h2>Convert the plan into controlled software workflows</h2><p>Each workflow below starts an organization-owned EV project. Neptune stores the owner, executive accountability, evidence link, design gate, deadline, blocker, status, and progress through the existing EV project API.</p></div><button className="btn gold" onClick={() => setView("Accountability")}>Open accountability</button></div>
        <div className="ev-concept-grid">{SOFTWARE_WORKFLOWS.map(workflow => <article key={workflow.title}><p className="eyebrow">{workflow.module}</p><h3>{workflow.title}</h3><p>{workflow.description}</p><button className="btn" onClick={() => openNew(workflow.workstream, workflow.projectTitle)}>Create linked workstream</button></article>)}</div>
      </section>
      <section className="ev-panel">
        <div className="ev-panel-head"><div><p className="eyebrow">Recommended Neptune Sequence</p><h2>How an operator uses the framework</h2></div></div>
        <div className="ev-numbered-list">
          <article><span>1</span><p>Define the future vessel concept and create its Shipyard Spec or Digital Twin workstream.</p></article>
          <article><span>2</span><p>Assign a responsible owner and accountable executive before any design, class, insurance, or regulatory work begins.</p></article>
          <article><span>3</span><p>Attach evidence URLs for FMEA, class comments, emergency plans, drill records, port contracts, and proposal decks.</p></article>
          <article><span>4</span><p>Record the next decision gate, target year, due date, current blocker, and measured progress.</p></article>
          <article><span>5</span><p>Use the Technical, Commercial, and Regulatory tabs as the control requirements for each linked project.</p></article>
          <article><span>6</span><p>Review blocked and due-soon work in Accountability until the project is approved or complete.</p></article>
        </div>
      </section>
    </div>}

    {view === "Accountability" && <section className="ev-accountability">
      <div className="ev-accountability-head"><div><p className="eyebrow">Program Accountability</p><h2>Turn future risk into owned work</h2><p>No invented projects are inserted. Every record below comes from your organization.</p></div><button className="btn gold" onClick={() => openNew()}>New EV project</button></div>
      <div className="ev-kpis"><article><span>Active projects</span><b>{summary.active}</b></article><article className={summary.blocked ? "danger" : ""}><span>Blocked</span><b>{summary.blocked}</b></article><article><span>Average progress</span><b>{summary.average}%</b></article><article className={summary.dueSoon ? "warning" : ""}><span>Due in 30 days</span><b>{summary.dueSoon}</b></article></div>
      {loading ? <p className="lede">Loading your EV development program...</p> : projects.length ? <div className="ev-project-grid">{projects.map(project => <article key={project.id} className={`ev-project ${statusClass(project.status)}`}><div className="ev-project-top"><span>{project.workstream}</span><b>{project.target_year}</b></div><h3>{project.title}</h3><p>{project.vessel_concept || "Cross-vessel development program"}</p><div className="ev-project-progress"><i style={{ width: `${project.progress || 0}%` }} /><span>{project.progress || 0}%</span></div><dl><div><dt>Owner</dt><dd>{project.owner}</dd></div><div><dt>Accountable executive</dt><dd>{project.accountable_executive || "Not assigned"}</dd></div><div><dt>Next gate</dt><dd>{project.next_gate || "Not defined"}</dd></div><div><dt>Due</dt><dd>{project.due_at ? new Date(project.due_at).toLocaleDateString() : "Not set"}</dd></div></dl>{project.blocker && <div className="ev-blocker"><b>Blocker</b><span>{project.blocker}</span></div>}<div className="ev-project-footer"><span className={`ev-status ${statusClass(project.status)}`}>{project.status}</span><div><button onClick={() => openEdit(project)}>Edit</button><button onClick={() => remove(project)}>Delete</button></div></div></article>)}</div> : <div className="ev-empty"><p className="eyebrow">No organization projects yet</p><h3>Create the first accountable EV development workstream.</h3><p>Start with the Shipyard Spec, MASS Shore Control SOP, or IMO Proposal Deck.</p><button className="btn gold" onClick={() => openNew()}>Create first project</button></div>}
    </section>}

    {showForm && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setShowForm(false); }}><section className="modal glass premium ev-project-modal"><div className="modal-head"><div><p className="eyebrow">EV Development Accountability</p><h2>{editing ? "Update project" : "Create project"}</h2></div><button className="modal-close" onClick={() => setShowForm(false)}>×</button></div><form className="form" onSubmit={save}>
      <label>Project title<input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="EV-READY 2030 e-PCTC Shipyard Specification" /></label>
      <label>Workstream<select value={form.workstream} onChange={event => setForm({ ...form, workstream: event.target.value })}>{WORKSTREAMS.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Vessel concept<select value={form.vesselConcept} onChange={event => setForm({ ...form, vesselConcept: event.target.value })}>{VESSEL_CONCEPTS.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Accountable owner<input required value={form.owner} onChange={event => setForm({ ...form, owner: event.target.value })} placeholder="Naval Architect / Fleet DPA" /></label>
      <label>Accountable executive<input value={form.accountableExecutive} onChange={event => setForm({ ...form, accountableExecutive: event.target.value })} placeholder="CTO / COO / Managing Director" /></label>
      <label>Status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })}>{STATUSES.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Target year<input type="number" min={2026} max={2035} value={form.targetYear} onChange={event => setForm({ ...form, targetYear: Number(event.target.value) })} /></label>
      <label>Progress %<input type="number" min={0} max={100} value={form.progress} onChange={event => setForm({ ...form, progress: Number(event.target.value) })} /></label>
      <label>Next design or approval gate<input value={form.nextGate} onChange={event => setForm({ ...form, nextGate: event.target.value })} placeholder="Class concept review" /></label>
      <label>Due date<input type="date" value={form.dueAt} onChange={event => setForm({ ...form, dueAt: event.target.value })} /></label>
      <label>Evidence or document URL<input type="url" value={form.evidenceUrl} onChange={event => setForm({ ...form, evidenceUrl: event.target.value })} placeholder="https://..." /></label>
      <label>Current blocker<input value={form.blocker} onChange={event => setForm({ ...form, blocker: event.target.value })} placeholder="Class interpretation pending" /></label>
      <label className="ev-form-wide">Development notes<textarea rows={5} value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Scope, dependencies, validation requirements, decisions, and evidence needed." /></label>
      <div className="actions ev-form-wide"><button className="btn gold" disabled={saving}>{saving ? "Saving..." : editing ? "Update project" : "Create project"}</button><button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button></div>
    </form></section></div>}
  </div>;
}
