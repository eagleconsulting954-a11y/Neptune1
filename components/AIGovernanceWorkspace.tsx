"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Layer = { key: string; name: string; short: string; purpose: string; controls: readonly string[] };
type AiSystem = {
  id: string; name: string; module?: string | null; purpose?: string | null; provider?: string | null; model_version?: string | null;
  prompt_version?: string | null; risk_tier: string; authority_level: string; owner?: string | null; environment?: string | null;
  status: string; data_access?: string | null; human_approval_required: boolean; assurance_score?: number | null;
  last_review_at?: string | null; next_review_at?: string | null; created_at?: string; updated_at?: string;
};
type Control = { id: string; system_id: string; layer_key: string; control_name: string; status: string; owner?: string | null; evidence?: string | null; last_reviewed_at?: string | null; next_review_at?: string | null };
type Finding = { id: string; system_id: string; layer_key: string; severity: string; title: string; description?: string | null; status: string; owner?: string | null; due_at?: string | null; resolved_at?: string | null; created_at?: string };
type Decision = { id: string; system_id: string; model_version?: string | null; prompt_version?: string | null; authority_level: string; input_sources?: string[]; output_summary: string; confidence?: number | null; policy_result?: string | null; human_reviewer?: string | null; override_status?: string | null; final_action?: string | null; created_at?: string };
type Evaluation = { id: string; system_id: string; evaluation_type: string; score?: number | null; status: string; notes?: string | null; reviewed_by?: string | null; created_at?: string };
type Audit = { id: string; user_email?: string | null; action: string; entity_type?: string | null; entity_id?: string | null; metadata?: Record<string, unknown> | null; created_at?: string };

type GovernanceData = {
  layers: Layer[];
  options: {
    riskTiers: string[]; authorityLevels: string[]; systemStatuses: string[]; controlStatuses: string[];
    findingStatuses: string[]; findingSeverities: string[];
  };
  summary: Record<string, number>;
  systems: AiSystem[];
  controls: Control[];
  findings: Finding[];
  decisions: Decision[];
  evaluations: Evaluation[];
  audit: Audit[];
};

type Modal =
  | { type: "system"; item?: AiSystem }
  | { type: "control"; layer: Layer; controlName: string; item?: Control }
  | { type: "finding"; layerKey?: string }
  | { type: "evaluation" }
  | { type: "decision" };

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

function tone(value: string) {
  return value.toLowerCase().replaceAll(" ", "-");
}

function systemName(data: GovernanceData | null, systemId: string) {
  return data?.systems.find(system => system.id === systemId)?.name || "Unknown AI system";
}

function controlScore(controls: Control[], layer: Layer, systemId: string) {
  const assessed = layer.controls.map(name => controls.find(item => item.system_id === systemId && item.layer_key === layer.key && item.control_name === name));
  const relevant = assessed.filter(item => item && item.status !== "Not applicable" && item.status !== "Not assessed") as Control[];
  if (!relevant.length) return 0;
  const points = relevant.reduce((sum, item) => sum + (item.status === "Implemented" ? 1 : item.status === "Partial" ? 0.5 : 0), 0);
  return Math.round((points / relevant.length) * 100);
}

export function AIGovernanceWorkspace() {
  const [data, setData] = useState<GovernanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedSystemId, setSelectedSystemId] = useState("");
  const [activeLayer, setActiveLayer] = useState("inventory");
  const [tab, setTab] = useState<"overview" | "registry" | "findings" | "evidence">("overview");
  const [modal, setModal] = useState<Modal | null>(null);
  const [saving, setSaving] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    const response = await fetch("/api/v1/admin/ai-governance", { cache: "no-store" });
    if (response.status === 401) { window.location.href = "/login?from=/ai-governance"; return; }
    if (response.status === 402) { window.location.href = "/trial-expired?from=/ai-governance"; return; }
    if (response.status === 403) { window.location.href = "/dashboard"; return; }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(payload.error || "Unable to load AI Governance.");
      setLoading(false);
      return;
    }
    setData(payload);
    setSelectedSystemId(current => current && payload.systems.some((system: AiSystem) => system.id === current) ? current : payload.systems[0]?.id || "");
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const selectedSystem = useMemo(() => data?.systems.find(system => system.id === selectedSystemId) || null, [data, selectedSystemId]);
  const selectedLayer = useMemo(() => data?.layers.find(layer => layer.key === activeLayer) || data?.layers[0] || null, [data, activeLayer]);
  const systemControls = useMemo(() => data?.controls.filter(control => control.system_id === selectedSystemId) || [], [data, selectedSystemId]);
  const systemFindings = useMemo(() => data?.findings.filter(finding => finding.system_id === selectedSystemId) || [], [data, selectedSystemId]);
  const systemDecisions = useMemo(() => data?.decisions.filter(decision => decision.system_id === selectedSystemId) || [], [data, selectedSystemId]);
  const systemEvaluations = useMemo(() => data?.evaluations.filter(evaluation => evaluation.system_id === selectedSystemId) || [], [data, selectedSystemId]);

  async function request(method: "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>, query?: string) {
    const response = await fetch(`/api/v1/admin/ai-governance${query || ""}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Governance request failed.");
    return payload;
  }

  async function saveSystem(event: React.FormEvent<HTMLFormElement>, item?: AiSystem) {
    event.preventDefault();
    setSaving(true); setMessage("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      const input = { ...values, human_approval_required: values.human_approval_required === "on", assurance_score: values.assurance_score === "" ? null : Number(values.assurance_score) };
      const result = item
        ? await request("PATCH", { action: "system.update", id: item.id, input })
        : await request("POST", { action: "system.create", input });
      setModal(null);
      if (!item && result.item?.id) setSelectedSystemId(result.item.id);
      setMessage(item ? "AI system governance profile updated." : "AI system added to the governed registry.");
      await load(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save AI system."); }
    finally { setSaving(false); }
  }

  async function saveControl(event: React.FormEvent<HTMLFormElement>, layer: Layer, controlName: string) {
    event.preventDefault();
    if (!selectedSystemId) return;
    setSaving(true); setMessage("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      await request("POST", { action: "control.upsert", input: { ...values, system_id: selectedSystemId, layer_key: layer.key, control_name: controlName } });
      setModal(null); setMessage(`${controlName} assessment saved with audit evidence.`); await load(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save control assessment."); }
    finally { setSaving(false); }
  }

  async function saveFinding(event: React.FormEvent<HTMLFormElement>, layerKey?: string) {
    event.preventDefault();
    if (!selectedSystemId) return;
    setSaving(true); setMessage("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      await request("POST", { action: "finding.create", input: { ...values, system_id: selectedSystemId, layer_key: values.layer_key || layerKey || activeLayer } });
      setModal(null); setMessage("Governance finding opened and added to the audit stream."); await load(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create finding."); }
    finally { setSaving(false); }
  }

  async function setFindingStatus(finding: Finding, status: string) {
    try {
      await request("PATCH", { action: "finding.update", id: finding.id, input: { status } });
      setMessage(`${finding.title} marked ${status}.`); await load(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update finding."); }
  }

  async function saveEvaluation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSystemId) return;
    setSaving(true); setMessage("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      await request("POST", { action: "evaluation.record", input: { ...values, system_id: selectedSystemId, score: values.score === "" ? null : Number(values.score) } });
      setModal(null); setMessage("Assurance evaluation recorded and the AI system score updated."); await load(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to record evaluation."); }
    finally { setSaving(false); }
  }

  async function saveDecision(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSystemId) return;
    setSaving(true); setMessage("");
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget).entries());
      await request("POST", { action: "decision.record", input: { ...values, system_id: selectedSystemId, confidence: values.confidence === "" ? null : Number(values.confidence) } });
      setModal(null); setMessage("AI decision evidence recorded with model, authority, human-review, and source context."); await load(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to record decision evidence."); }
    finally { setSaving(false); }
  }

  async function removeSystem(system: AiSystem) {
    if (!window.confirm(`Delete ${system.name} and its governance controls, findings, evaluations, and decision records? Immutable audit events remain.`)) return;
    try {
      await request("DELETE", undefined, `?type=system&id=${encodeURIComponent(system.id)}`);
      setMessage(`${system.name} removed from the active AI registry.`); await load(true);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to delete AI system."); }
  }

  if (loading || !data) return <main className="ai-gov-shell"><section className="ai-gov-loading glass premium"><div className="radar" /><h1>Loading Neptune AI Governance...</h1><p>Building the live control posture from registered systems, controls, findings, evaluations, and immutable evidence.</p>{message && <div className="form-message">{message}</div>}</section></main>;

  return <main className="ai-gov-shell">
    <header className="ai-gov-header glass premium">
      <div>
        <p className="eyebrow">NEPTUNE · AI GOVERNANCE CONTROL PLANE</p>
        <h1>Govern AI like operational infrastructure.</h1>
        <p>Inventory → provenance → security → assurance → human authority → audit → runtime response → lifecycle control.</p>
      </div>
      <div className="ai-gov-header-actions">
        <Link className="btn" href="/admin">CRM Admin</Link>
        <Link className="btn" href="/platform-admin">Platform Admin</Link>
        <Link className="btn" href="/dashboard">Vessel Command</Link>
        <button className="btn gold" onClick={() => setModal({ type: "system" })}>Register AI system</button>
      </div>
    </header>

    {message && <div className="form-message ai-gov-message" role="status">{message}</div>}

    <section className="ai-gov-posture-grid">
      <PostureCard label="Governance readiness" value={`${data.summary.readiness || 0}%`} detail={`${data.summary.controlReadiness || 0}% control implementation`} emphasis />
      <PostureCard label="AI systems" value={data.summary.systems || 0} detail={`${data.summary.approved || 0} approved · ${data.summary.restricted || 0} restricted`} />
      <PostureCard label="High-risk systems" value={data.summary.highRisk || 0} detail="High + critical risk tiers" alert={Boolean(data.summary.highRisk)} />
      <PostureCard label="Open findings" value={data.summary.openFindings || 0} detail={`${data.summary.criticalFindings || 0} critical`} alert={Boolean(data.summary.criticalFindings)} />
      <PostureCard label="Overdue reviews" value={data.summary.overdueReviews || 0} detail="Governance review date passed" alert={Boolean(data.summary.overdueReviews)} />
      <PostureCard label="Assurance average" value={`${data.summary.assuranceAverage || 0}%`} detail="Latest recorded system scores" />
    </section>

    <section className="ai-gov-authority glass premium">
      <div><p className="eyebrow">Authority Boundary</p><h2>Observe → Recommend → Approve → Execute</h2><p>Every registered AI system receives an explicit authority level. High-risk maritime functions can be restricted to advisory-only use with mandatory human approval.</p></div>
      <div className="ai-gov-authority-rail"><span>Observe</span><i>→</i><span>Recommend</span><i>→</i><span>Approve</span><i>→</i><span>Execute</span><b>Human override remains authoritative</b></div>
    </section>

    <nav className="ai-gov-tabs glass" aria-label="AI governance views">
      {(["overview","registry","findings","evidence"] as const).map(view => <button key={view} className={tab === view ? "active" : ""} onClick={() => setTab(view)}>{view === "overview" ? "Control Plane" : view === "registry" ? "AI Registry" : view === "findings" ? "Findings" : "Evidence & Decisions"}</button>)}
    </nav>

    {tab === "overview" && <>
      {!data.systems.length ? <EmptyRegistry onAdd={() => setModal({ type: "system" })} /> : <>
        <section className="ai-gov-system-focus glass premium">
          <div><p className="eyebrow">Governed System</p><h2>{selectedSystem?.name}</h2><p>{selectedSystem?.purpose || "Add the operating purpose to complete this governance profile."}</p></div>
          <div className="ai-gov-system-picker"><label>Active governance profile<select value={selectedSystemId} onChange={event => setSelectedSystemId(event.target.value)}>{data.systems.map(system => <option key={system.id} value={system.id}>{system.name}</option>)}</select></label><button className="btn" onClick={() => selectedSystem && setModal({ type: "system", item: selectedSystem })}>Edit profile</button></div>
          <div className="ai-gov-system-badges"><span className={`gov-pill risk-${tone(selectedSystem?.risk_tier || "Moderate")}`}>{selectedSystem?.risk_tier} risk</span><span className="gov-pill">{selectedSystem?.authority_level}</span><span className={`gov-pill status-${tone(selectedSystem?.status || "Draft")}`}>{selectedSystem?.status}</span><span className="gov-pill">Assurance {selectedSystem?.assurance_score ?? 0}%</span>{selectedSystem?.human_approval_required && <span className="gov-pill human-required">Human approval required</span>}</div>
        </section>

        <section className="ai-gov-stack" aria-label="Eight AI governance layers">
          {data.layers.map((layer, index) => {
            const scoreValue = selectedSystemId ? controlScore(data.controls, layer, selectedSystemId) : 0;
            const gaps = layer.controls.filter(name => systemControls.find(item => item.layer_key === layer.key && item.control_name === name)?.status === "Gap").length;
            return <button key={layer.key} className={`ai-gov-layer layer-${index + 1} ${activeLayer === layer.key ? "active" : ""}`} onClick={() => setActiveLayer(layer.key)}>
              <div className="ai-gov-layer-number">{String(index + 1).padStart(2,"0")}</div>
              <div className="ai-gov-layer-title"><b>{layer.name}</b><span>{layer.purpose}</span></div>
              <div className="ai-gov-layer-controls">{layer.controls.map(control => <span key={control}>{control}</span>)}</div>
              <div className="ai-gov-layer-score"><strong>{scoreValue}%</strong><small>{gaps ? `${gaps} gap${gaps === 1 ? "" : "s"}` : "No recorded gaps"}</small></div>
            </button>;
          })}
        </section>

        {selectedLayer && <section className="ai-gov-control-panel glass premium">
          <div className="ai-gov-panel-head"><div><p className="eyebrow">Layer Assessment</p><h2>{selectedLayer.name}</h2><p>{selectedLayer.purpose}</p></div><button className="btn" onClick={() => setModal({ type: "finding", layerKey: selectedLayer.key })}>Open finding</button></div>
          <div className="ai-gov-control-grid">{selectedLayer.controls.map(controlName => {
            const item = systemControls.find(control => control.layer_key === selectedLayer.key && control.control_name === controlName);
            return <button className="ai-gov-control-card" key={controlName} onClick={() => setModal({ type: "control", layer: selectedLayer, controlName, item })}><span className={`control-state state-${tone(item?.status || "Not assessed")}`}>{item?.status || "Not assessed"}</span><b>{controlName}</b><p>{item?.evidence || "No evidence recorded yet."}</p><small>{item?.owner ? `Owner: ${item.owner}` : "Assign owner"}{item?.next_review_at ? ` · Review ${shortDate(item.next_review_at)}` : ""}</small></button>;
          })}</div>
        </section>}
      </>}
    </>}

    {tab === "registry" && <section className="ai-gov-panel glass premium">
      <div className="ai-gov-panel-head"><div><p className="eyebrow">AI System Registry</p><h2>Every governed model, agent, and AI capability</h2></div><button className="btn gold" onClick={() => setModal({ type: "system" })}>Register system</button></div>
      {!data.systems.length ? <EmptyRegistry onAdd={() => setModal({ type: "system" })} compact /> : <div className="ai-gov-table-wrap"><table><thead><tr><th>System</th><th>Module</th><th>Risk</th><th>Authority</th><th>Owner</th><th>Model</th><th>Assurance</th><th>Review</th><th>Actions</th></tr></thead><tbody>{data.systems.map(system => <tr key={system.id}><td><b>{system.name}</b><small>{system.status}</small></td><td>{system.module || "—"}</td><td><span className={`gov-pill risk-${tone(system.risk_tier)}`}>{system.risk_tier}</span></td><td>{system.authority_level}{system.human_approval_required && <small>Human approval</small>}</td><td>{system.owner || "Unassigned"}</td><td>{system.provider || "—"}<small>{system.model_version || "Version not recorded"}</small></td><td>{system.assurance_score ?? 0}%</td><td>{shortDate(system.next_review_at)}</td><td><div className="actions"><button className="btn" onClick={() => { setSelectedSystemId(system.id); setModal({ type: "system", item: system }); }}>Edit</button><button className="btn danger" onClick={() => removeSystem(system)}>Delete</button></div></td></tr>)}</tbody></table></div>}
    </section>}

    {tab === "findings" && <section className="ai-gov-panel glass premium">
      <div className="ai-gov-panel-head"><div><p className="eyebrow">Governance Findings</p><h2>Gaps, accepted risks, and remediation</h2></div><div className="actions">{data.systems.length > 0 && <><select value={selectedSystemId} onChange={event => setSelectedSystemId(event.target.value)}>{data.systems.map(system => <option key={system.id} value={system.id}>{system.name}</option>)}</select><button className="btn gold" onClick={() => setModal({ type: "finding" })}>Open finding</button></>}</div></div>
      {!data.findings.length ? <EmptyState title="No governance findings recorded" body="Findings appear here when a control gap, assurance issue, policy exception, or runtime concern is formally recorded." /> : <div className="ai-gov-finding-list">{data.findings.map(finding => <article key={finding.id} className={`ai-gov-finding severity-${tone(finding.severity)}`}><div><span className={`gov-pill risk-${tone(finding.severity)}`}>{finding.severity}</span><b>{finding.title}</b><p>{finding.description || "No additional description."}</p><small>{systemName(data, finding.system_id)} · {data.layers.find(layer => layer.key === finding.layer_key)?.name || finding.layer_key} · Owner {finding.owner || "unassigned"} · Due {shortDate(finding.due_at)}</small></div><div className="ai-gov-finding-actions"><span className={`gov-pill status-${tone(finding.status)}`}>{finding.status}</span>{finding.status !== "Resolved" && <button className="btn" onClick={() => setFindingStatus(finding,"Resolved")}>Resolve</button>}{finding.status === "Open" && <button className="btn" onClick={() => setFindingStatus(finding,"In progress")}>Start work</button>}</div></article>)}</div>}
    </section>}

    {tab === "evidence" && <>
      <section className="ai-gov-panel glass premium">
        <div className="ai-gov-panel-head"><div><p className="eyebrow">Decision Evidence</p><h2>Data → model → recommendation → human authority → action</h2></div>{data.systems.length > 0 && <div className="actions"><select value={selectedSystemId} onChange={event => setSelectedSystemId(event.target.value)}>{data.systems.map(system => <option key={system.id} value={system.id}>{system.name}</option>)}</select><button className="btn" onClick={() => setModal({ type: "evaluation" })}>Record evaluation</button><button className="btn gold" onClick={() => setModal({ type: "decision" })}>Record decision</button></div>}</div>
        {!data.systems.length ? <EmptyRegistry onAdd={() => setModal({ type: "system" })} compact /> : <div className="ai-gov-evidence-grid">
          <article><h3>Assurance evaluations</h3>{systemEvaluations.length ? systemEvaluations.slice(0,12).map(item => <div className="evidence-row" key={item.id}><span><b>{item.evaluation_type}</b><small>{item.reviewed_by || "Reviewer not recorded"} · {dateTime(item.created_at)}</small></span><strong>{item.score ?? "—"}{item.score !== null && item.score !== undefined ? "%" : ""}</strong></div>) : <p className="muted">No evaluations recorded for this system.</p>}</article>
          <article><h3>AI decision records</h3>{systemDecisions.length ? systemDecisions.slice(0,12).map(item => <div className="evidence-row decision-row" key={item.id}><span><b>{item.output_summary}</b><small>{item.authority_level} · {item.human_reviewer ? `Reviewed by ${item.human_reviewer}` : "No human reviewer recorded"} · {dateTime(item.created_at)}</small></span><strong>{item.confidence ?? "—"}{item.confidence !== null && item.confidence !== undefined ? "%" : ""}</strong></div>) : <p className="muted">No AI decision evidence recorded for this system.</p>}</article>
        </div>}
      </section>
      <section className="ai-gov-panel glass premium"><div className="ai-gov-panel-head"><div><p className="eyebrow">Immutable Governance Audit</p><h2>Administrative evidence stream</h2></div><span className="gov-pill">Append-only audit</span></div>{data.audit.length ? <div className="ai-gov-audit-list">{data.audit.map(item => <div key={item.id}><i /><span><b>{item.action.replaceAll("ai_governance.","").replaceAll("_"," ")}</b><small>{item.user_email || "Neptune system"} · {dateTime(item.created_at)}</small></span><code>{item.entity_type || "governance"}</code></div>)}</div> : <EmptyState title="No governance audit events yet" body="Governance actions will appear here as systems, controls, findings, evaluations, and decision evidence are recorded." />}</section>
    </>}

    {modal && <GovernanceModal modal={modal} data={data} selectedSystem={selectedSystem} saving={saving} close={() => setModal(null)} saveSystem={saveSystem} saveControl={saveControl} saveFinding={saveFinding} saveEvaluation={saveEvaluation} saveDecision={saveDecision} />}
  </main>;
}

function GovernanceModal({ modal, data, selectedSystem, saving, close, saveSystem, saveControl, saveFinding, saveEvaluation, saveDecision }: {
  modal: Modal; data: GovernanceData; selectedSystem: AiSystem | null; saving: boolean; close: () => void;
  saveSystem: (event: React.FormEvent<HTMLFormElement>, item?: AiSystem) => void;
  saveControl: (event: React.FormEvent<HTMLFormElement>, layer: Layer, controlName: string) => void;
  saveFinding: (event: React.FormEvent<HTMLFormElement>, layerKey?: string) => void;
  saveEvaluation: (event: React.FormEvent<HTMLFormElement>) => void;
  saveDecision: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return <div className="modal-backdrop ai-gov-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) close(); }}><section className="modal glass premium ai-gov-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><p className="eyebrow">AI Governance</p><h2>{modal.type === "system" ? (modal.item ? `Edit ${modal.item.name}` : "Register AI system") : modal.type === "control" ? modal.controlName : modal.type === "finding" ? "Open governance finding" : modal.type === "evaluation" ? "Record assurance evaluation" : "Record AI decision evidence"}</h2></div><button className="modal-close" onClick={close} aria-label="Close">×</button></div>
    {modal.type === "system" && <form className="form ai-gov-form" onSubmit={event => saveSystem(event, modal.item)}>
      <div className="ai-gov-form-grid"><label>System / agent name<input name="name" required maxLength={180} defaultValue={modal.item?.name || ""} /></label><label>Neptune module<input name="module" maxLength={160} defaultValue={modal.item?.module || ""} placeholder="Maritime Intel, Maintenance, Emergency..." /></label><label>Provider<input name="provider" maxLength={160} defaultValue={modal.item?.provider || ""} placeholder="Approved AI provider" /></label><label>Model version<input name="model_version" maxLength={160} defaultValue={modal.item?.model_version || ""} /></label><label>Prompt / agent version<input name="prompt_version" maxLength={160} defaultValue={modal.item?.prompt_version || ""} /></label><label>Owner<input name="owner" maxLength={180} defaultValue={modal.item?.owner || ""} placeholder="Fleet Operations" /></label><label>Risk tier<select name="risk_tier" defaultValue={modal.item?.risk_tier || "Moderate"}>{data.options.riskTiers.map(option => <option key={option}>{option}</option>)}</select></label><label>Authority level<select name="authority_level" defaultValue={modal.item?.authority_level || "Recommend"}>{data.options.authorityLevels.map(option => <option key={option}>{option}</option>)}</select></label><label>Status<select name="status" defaultValue={modal.item?.status || "Draft"}>{data.options.systemStatuses.map(option => <option key={option}>{option}</option>)}</select></label><label>Environment<input name="environment" defaultValue={modal.item?.environment || "Production"} maxLength={80} /></label><label>Assurance score<input name="assurance_score" type="number" min="0" max="100" defaultValue={modal.item?.assurance_score ?? ""} /></label><label>Next review<input name="next_review_at" type="date" defaultValue={modal.item?.next_review_at ? String(modal.item.next_review_at).slice(0,10) : ""} /></label></div>
      <label>Operating purpose<textarea name="purpose" rows={3} maxLength={2000} defaultValue={modal.item?.purpose || ""} placeholder="What this system is intended to do and what decisions it supports." /></label><label>Data access<textarea name="data_access" rows={3} maxLength={2000} defaultValue={modal.item?.data_access || ""} placeholder="AIS, GNSS, weather, vessel records, CRM, documents..." /></label><label className="ai-gov-check"><input name="human_approval_required" type="checkbox" defaultChecked={modal.item?.human_approval_required ?? true} /> Human approval required before high-impact action</label><div className="actions"><button className="btn gold" disabled={saving}>{saving ? "Saving..." : "Save governed system"}</button><button type="button" className="btn" onClick={close}>Cancel</button></div>
    </form>}
    {modal.type === "control" && <form className="form ai-gov-form" onSubmit={event => saveControl(event, modal.layer, modal.controlName)}><p className="muted">{modal.layer.name} · {selectedSystem?.name}</p><label>Control status<select name="status" defaultValue={modal.item?.status || "Not assessed"}>{data.options.controlStatuses.map(option => <option key={option}>{option}</option>)}</select></label><label>Control owner<input name="owner" maxLength={180} defaultValue={modal.item?.owner || selectedSystem?.owner || ""} /></label><label>Evidence / implementation notes<textarea name="evidence" rows={6} maxLength={5000} defaultValue={modal.item?.evidence || ""} placeholder="Reference the policy, test result, configuration, approval, report, or other evidence supporting this control status." /></label><div className="ai-gov-form-grid"><label>Last reviewed<input name="last_reviewed_at" type="date" defaultValue={modal.item?.last_reviewed_at ? String(modal.item.last_reviewed_at).slice(0,10) : new Date().toISOString().slice(0,10)} /></label><label>Next review<input name="next_review_at" type="date" defaultValue={modal.item?.next_review_at ? String(modal.item.next_review_at).slice(0,10) : ""} /></label></div><div className="actions"><button className="btn gold" disabled={saving}>{saving ? "Saving..." : "Save control evidence"}</button><button type="button" className="btn" onClick={close}>Cancel</button></div></form>}
    {modal.type === "finding" && <form className="form ai-gov-form" onSubmit={event => saveFinding(event, modal.layerKey)}><p className="muted">{selectedSystem?.name}</p><div className="ai-gov-form-grid"><label>Governance layer<select name="layer_key" defaultValue={modal.layerKey || data.layers[0]?.key}>{data.layers.map(layer => <option key={layer.key} value={layer.key}>{layer.name}</option>)}</select></label><label>Severity<select name="severity" defaultValue="Moderate">{data.options.findingSeverities.map(option => <option key={option}>{option}</option>)}</select></label><label>Status<select name="status" defaultValue="Open">{data.options.findingStatuses.map(option => <option key={option}>{option}</option>)}</select></label><label>Owner<input name="owner" maxLength={180} defaultValue={selectedSystem?.owner || ""} /></label><label>Due date<input name="due_at" type="date" /></label></div><label>Finding title<input name="title" required maxLength={240} /></label><label>Description<textarea name="description" rows={5} maxLength={5000} /></label><div className="actions"><button className="btn gold" disabled={saving}>{saving ? "Saving..." : "Open finding"}</button><button type="button" className="btn" onClick={close}>Cancel</button></div></form>}
    {modal.type === "evaluation" && <form className="form ai-gov-form" onSubmit={saveEvaluation}><p className="muted">{selectedSystem?.name}</p><div className="ai-gov-form-grid"><label>Evaluation type<input name="evaluation_type" required maxLength={180} placeholder="Red-team test, hallucination benchmark, drift review..." /></label><label>Score<input name="score" type="number" min="0" max="100" /></label><label>Status<input name="status" maxLength={80} defaultValue="Completed" /></label><label>Reviewed by<input name="reviewed_by" maxLength={180} /></label></div><label>Evaluation notes<textarea name="notes" rows={6} maxLength={5000} /></label><div className="actions"><button className="btn gold" disabled={saving}>{saving ? "Saving..." : "Record evaluation"}</button><button type="button" className="btn" onClick={close}>Cancel</button></div></form>}
    {modal.type === "decision" && <form className="form ai-gov-form" onSubmit={saveDecision}><p className="muted">{selectedSystem?.name}</p><div className="ai-gov-form-grid"><label>Model version<input name="model_version" maxLength={160} defaultValue={selectedSystem?.model_version || ""} /></label><label>Prompt version<input name="prompt_version" maxLength={160} defaultValue={selectedSystem?.prompt_version || ""} /></label><label>Authority level<select name="authority_level" defaultValue={selectedSystem?.authority_level || "Recommend"}>{data.options.authorityLevels.map(option => <option key={option}>{option}</option>)}</select></label><label>Confidence %<input name="confidence" type="number" min="0" max="100" /></label><label>Human reviewer<input name="human_reviewer" maxLength={180} /></label><label>Override status<input name="override_status" maxLength={160} placeholder="Accepted, overridden, not required..." /></label></div><label>Input sources<textarea name="input_sources" rows={3} placeholder="One source per line: AIS, weather provider, vessel record, operator input..." /></label><label>AI output / recommendation<textarea name="output_summary" required rows={5} maxLength={5000} /></label><label>Policy checks / result<textarea name="policy_result" rows={3} maxLength={500} /></label><label>Final human-authorized action<textarea name="final_action" rows={3} maxLength={1000} /></label><div className="actions"><button className="btn gold" disabled={saving}>{saving ? "Saving..." : "Record decision evidence"}</button><button type="button" className="btn" onClick={close}>Cancel</button></div></form>}
  </section></div>;
}

function PostureCard({ label, value, detail, alert, emphasis }: { label: string; value: string | number; detail: string; alert?: boolean; emphasis?: boolean }) {
  return <article className={`ai-gov-posture glass ${alert ? "alert" : ""} ${emphasis ? "emphasis" : ""}`}><span>{label}</span><b>{value}</b><small>{detail}</small></article>;
}

function EmptyRegistry({ onAdd, compact }: { onAdd: () => void; compact?: boolean }) {
  return <section className={`ai-gov-empty glass premium ${compact ? "compact" : ""}`}><p className="eyebrow">No AI systems registered</p><h2>Start with the real AI capabilities Neptune actually uses.</h2><p>No sample models or fake governance scores are inserted. Register an actual model, agent, or AI-enabled workflow and Neptune will build the control posture from your evidence.</p><button className="btn gold" onClick={onAdd}>Register first AI system</button></section>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="ai-gov-empty-state"><h3>{title}</h3><p>{body}</p></div>;
}
