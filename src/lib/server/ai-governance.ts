import { randomUUID } from "crypto";
import type { ProtectedSession } from "@/src/lib/server/auth";
import { sql, type Row } from "@/src/lib/server/db";
import { recordAuditEvent } from "@/src/lib/server/security";

export const AI_GOVERNANCE_LAYERS = [
  {
    key: "inventory",
    name: "AI Inventory & Ownership",
    short: "Inventory",
    purpose: "Know every AI system, where it is used, who owns it, and how much authority it has.",
    controls: ["Shadow AI Detection", "System Classification", "Risk Tiering", "Ownership Assignment", "Model Registry"]
  },
  {
    key: "data_foundation",
    name: "Data Foundation & Provenance",
    short: "Data",
    purpose: "Trace operational data to its source and continuously assess quality, lineage, freshness, and coverage.",
    controls: ["Source Tracking", "Lineage Mapping", "Quality Validation", "Freshness Monitoring", "Data Bias Screening"]
  },
  {
    key: "security_access",
    name: "Data Security & Access",
    short: "Security",
    purpose: "Restrict what AI systems and operators can read, write, transmit, or retain.",
    controls: ["Encryption", "Anonymization", "Role-Based Access", "Least Privilege", "Key Management"]
  },
  {
    key: "model_assurance",
    name: "Model & Agent Assurance",
    short: "Assurance",
    purpose: "Evaluate models, prompts, tools, and agent behavior before and after deployment.",
    controls: ["Model Cards", "Performance Benchmarks", "Fairness Testing", "Red-Teaming", "Drift Detection"]
  },
  {
    key: "human_oversight",
    name: "Human Oversight & Authority",
    short: "Oversight",
    purpose: "Keep accountable people in control of high-risk recommendations and actions.",
    controls: ["Decision Review", "Escalation Paths", "Override Authority", "Output Validation", "Accountability Mapping"]
  },
  {
    key: "compliance_audit",
    name: "Compliance, Policy & Audit",
    short: "Audit",
    purpose: "Map policies and obligations to enforceable controls and immutable evidence.",
    controls: ["EU AI Act Mapping", "GDPR Alignment", "Policy Enforcement", "Incident Reporting", "Audit Trails"]
  },
  {
    key: "runtime_monitoring",
    name: "Runtime Monitoring & AI Incident Response",
    short: "Runtime",
    purpose: "Detect failures, unsafe behavior, data-source problems, provider outages, and permission violations while AI is operating.",
    controls: ["Tool-Call Monitoring", "Output Error Alerts", "Provider & Data Health", "Anomaly Detection", "Kill Switch & Rollback"]
  },
  {
    key: "lifecycle_vendor",
    name: "Lifecycle, Vendor & Change Governance",
    short: "Lifecycle",
    purpose: "Control model, prompt, provider, and deployment changes from onboarding through retirement.",
    controls: ["Provider Registry", "Model & Prompt Change Control", "Vendor Risk Review", "Deployment Approval", "Recertification & Retirement"]
  }
] as const;

export const AI_RISK_TIERS = ["Low", "Moderate", "High", "Critical"] as const;
export const AI_AUTHORITY_LEVELS = ["Observe", "Recommend", "Approve", "Execute", "Advisory only"] as const;
export const AI_SYSTEM_STATUSES = ["Draft", "In review", "Approved", "Restricted", "Suspended", "Retired"] as const;
export const AI_CONTROL_STATUSES = ["Not assessed", "Implemented", "Partial", "Gap", "Not applicable"] as const;
export const AI_FINDING_STATUSES = ["Open", "In progress", "Accepted risk", "Resolved"] as const;
export const AI_FINDING_SEVERITIES = ["Low", "Moderate", "High", "Critical"] as const;

const layerKeys = new Set(AI_GOVERNANCE_LAYERS.map(layer => layer.key));
const riskTiers = new Set<string>(AI_RISK_TIERS);
const authorityLevels = new Set<string>(AI_AUTHORITY_LEVELS);
const systemStatuses = new Set<string>(AI_SYSTEM_STATUSES);
const controlStatuses = new Set<string>(AI_CONTROL_STATUSES);
const findingStatuses = new Set<string>(AI_FINDING_STATUSES);
const findingSeverities = new Set<string>(AI_FINDING_SEVERITIES);

function clean(value: unknown, max = 500) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

function required(value: unknown, field: string, max = 500) {
  const text = clean(value, max);
  if (!text) throw new Error(`AI_GOV_${field.toUpperCase()}_REQUIRED`);
  return text;
}

function enumValue(value: unknown, allowed: Set<string>, field: string, fallback?: string) {
  const text = clean(value, 80) || fallback;
  if (!text || !allowed.has(text)) throw new Error(`AI_GOV_${field.toUpperCase()}_INVALID`);
  return text;
}

function optionalDate(value: unknown, field: string) {
  const text = clean(value, 40);
  if (!text) return null;
  const candidate = text.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) throw new Error(`AI_GOV_${field.toUpperCase()}_INVALID`);
  const date = new Date(`${candidate}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== candidate) throw new Error(`AI_GOV_${field.toUpperCase()}_INVALID`);
  return candidate;
}

function optionalDateTime(value: unknown, field: string) {
  const text = clean(value, 80);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`AI_GOV_${field.toUpperCase()}_INVALID`);
  return date.toISOString();
}

function score(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100) throw new Error(`AI_GOV_${field.toUpperCase()}_INVALID`);
  return Math.round(amount);
}

function bool(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1" || value === 1) return true;
  if (value === "false" || value === "0" || value === 0) return false;
  return fallback;
}

async function assertSystem(orgId: string, systemId: string) {
  const [system] = await sql<Row>("select * from ai_systems where id=$1 and org_id=$2 limit 1", [systemId, orgId]);
  if (!system) throw new Error("AI_GOV_SYSTEM_NOT_FOUND");
  return system;
}

export async function listGovernance(orgId: string) {
  const [systems, controls, findings, decisions, evaluations, audit] = await Promise.all([
    sql<Row>("select * from ai_systems where org_id=$1 order by case risk_tier when 'Critical' then 0 when 'High' then 1 when 'Moderate' then 2 else 3 end, updated_at desc", [orgId]),
    sql<Row>("select * from ai_governance_controls where org_id=$1 order by system_id,layer_key,control_name", [orgId]),
    sql<Row>("select * from ai_governance_findings where org_id=$1 order by case severity when 'Critical' then 0 when 'High' then 1 when 'Moderate' then 2 else 3 end, created_at desc", [orgId]),
    sql<Row>("select * from ai_decision_records where org_id=$1 order by created_at desc limit 100", [orgId]),
    sql<Row>("select * from ai_assurance_evaluations where org_id=$1 order by created_at desc limit 100", [orgId]),
    sql<Row>("select id,user_email,action,entity_type,entity_id,metadata,created_at from audit_events where org_id=$1 and (action like 'ai_governance.%' or entity_type like 'ai_%') order by created_at desc limit 50", [orgId])
  ]);

  const assessed = controls.filter(control => control.status !== "Not assessed" && control.status !== "Not applicable");
  const implemented = assessed.filter(control => control.status === "Implemented").length;
  const partial = assessed.filter(control => control.status === "Partial").length;
  const controlReadiness = assessed.length ? Math.round(((implemented + partial * 0.5) / assessed.length) * 100) : 0;
  const activeSystems = systems.filter(system => !["Retired"].includes(String(system.status)));
  const assuranceValues = activeSystems.map(system => Number(system.assurance_score)).filter(value => Number.isFinite(value));
  const assuranceAverage = assuranceValues.length ? Math.round(assuranceValues.reduce((a, b) => a + b, 0) / assuranceValues.length) : 0;
  const today = Date.now();
  const overdueReviews = activeSystems.filter(system => system.next_review_at && new Date(system.next_review_at).getTime() < today).length;
  const openFindings = findings.filter(finding => !["Resolved"].includes(String(finding.status)));
  const criticalFindings = openFindings.filter(finding => finding.severity === "Critical").length;
  const approved = activeSystems.filter(system => system.status === "Approved").length;
  const readinessParts = [controlReadiness, assuranceAverage, activeSystems.length ? Math.round((approved / activeSystems.length) * 100) : 0];
  const readiness = Math.round(readinessParts.reduce((a, b) => a + b, 0) / readinessParts.length);

  return {
    layers: AI_GOVERNANCE_LAYERS,
    options: {
      riskTiers: AI_RISK_TIERS,
      authorityLevels: AI_AUTHORITY_LEVELS,
      systemStatuses: AI_SYSTEM_STATUSES,
      controlStatuses: AI_CONTROL_STATUSES,
      findingStatuses: AI_FINDING_STATUSES,
      findingSeverities: AI_FINDING_SEVERITIES
    },
    summary: {
      readiness,
      systems: systems.length,
      activeSystems: activeSystems.length,
      approved,
      restricted: activeSystems.filter(system => system.status === "Restricted" || system.status === "Suspended").length,
      highRisk: activeSystems.filter(system => system.risk_tier === "High" || system.risk_tier === "Critical").length,
      openFindings: openFindings.length,
      criticalFindings,
      overdueReviews,
      controlReadiness,
      assuranceAverage,
      decisionsRecorded: decisions.length
    },
    systems,
    controls,
    findings,
    decisions,
    evaluations,
    audit
  };
}

export async function createAiSystem(session: ProtectedSession, input: Record<string, unknown>, request?: Request | null) {
  const id = `ais_${randomUUID()}`;
  const riskTier = enumValue(input.risk_tier, riskTiers, "risk_tier", "Moderate");
  const authority = enumValue(input.authority_level, authorityLevels, "authority_level", "Recommend");
  const status = enumValue(input.status, systemStatuses, "status", "Draft");
  const item = {
    id,
    name: required(input.name, "name", 180),
    module: clean(input.module, 160),
    purpose: clean(input.purpose, 2000),
    provider: clean(input.provider, 160),
    model_version: clean(input.model_version, 160),
    prompt_version: clean(input.prompt_version, 160),
    risk_tier: riskTier,
    authority_level: authority,
    owner: clean(input.owner, 180),
    environment: clean(input.environment, 80) || "Production",
    status,
    data_access: clean(input.data_access, 2000),
    human_approval_required: bool(input.human_approval_required, ["High", "Critical"].includes(riskTier)),
    assurance_score: score(input.assurance_score, "assurance_score"),
    last_review_at: optionalDate(input.last_review_at, "last_review_at"),
    next_review_at: optionalDate(input.next_review_at, "next_review_at")
  };
  const [created] = await sql<Row>(`
    insert into ai_systems(
      id,org_id,name,module,purpose,provider,model_version,prompt_version,risk_tier,authority_level,owner,environment,status,
      data_access,human_approval_required,assurance_score,last_review_at,next_review_at,updated_at
    ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now()) returning *
  `, [id, session.orgId, item.name, item.module, item.purpose, item.provider, item.model_version, item.prompt_version, item.risk_tier, item.authority_level, item.owner, item.environment, item.status, item.data_access, item.human_approval_required, item.assurance_score, item.last_review_at, item.next_review_at]);
  await recordAuditEvent({ session, action: "ai_governance.system_created", entityType: "ai_system", entityId: id, route: "/api/v1/admin/ai-governance", method: "POST", request: request || null, metadata: { name: item.name, riskTier, authority, status } });
  return created;
}

export async function updateAiSystem(session: ProtectedSession, id: string, input: Record<string, unknown>, request?: Request | null) {
  const existing = await assertSystem(session.orgId, id);
  const next = {
    name: Object.hasOwn(input, "name") ? required(input.name, "name", 180) : existing.name,
    module: Object.hasOwn(input, "module") ? clean(input.module, 160) : existing.module,
    purpose: Object.hasOwn(input, "purpose") ? clean(input.purpose, 2000) : existing.purpose,
    provider: Object.hasOwn(input, "provider") ? clean(input.provider, 160) : existing.provider,
    model_version: Object.hasOwn(input, "model_version") ? clean(input.model_version, 160) : existing.model_version,
    prompt_version: Object.hasOwn(input, "prompt_version") ? clean(input.prompt_version, 160) : existing.prompt_version,
    risk_tier: Object.hasOwn(input, "risk_tier") ? enumValue(input.risk_tier, riskTiers, "risk_tier") : existing.risk_tier,
    authority_level: Object.hasOwn(input, "authority_level") ? enumValue(input.authority_level, authorityLevels, "authority_level") : existing.authority_level,
    owner: Object.hasOwn(input, "owner") ? clean(input.owner, 180) : existing.owner,
    environment: Object.hasOwn(input, "environment") ? clean(input.environment, 80) : existing.environment,
    status: Object.hasOwn(input, "status") ? enumValue(input.status, systemStatuses, "status") : existing.status,
    data_access: Object.hasOwn(input, "data_access") ? clean(input.data_access, 2000) : existing.data_access,
    human_approval_required: Object.hasOwn(input, "human_approval_required") ? bool(input.human_approval_required) : existing.human_approval_required,
    assurance_score: Object.hasOwn(input, "assurance_score") ? score(input.assurance_score, "assurance_score") : existing.assurance_score,
    last_review_at: Object.hasOwn(input, "last_review_at") ? optionalDate(input.last_review_at, "last_review_at") : existing.last_review_at,
    next_review_at: Object.hasOwn(input, "next_review_at") ? optionalDate(input.next_review_at, "next_review_at") : existing.next_review_at
  };
  const [updated] = await sql<Row>(`
    update ai_systems set name=$1,module=$2,purpose=$3,provider=$4,model_version=$5,prompt_version=$6,risk_tier=$7,authority_level=$8,
      owner=$9,environment=$10,status=$11,data_access=$12,human_approval_required=$13,assurance_score=$14,last_review_at=$15,next_review_at=$16,updated_at=now()
    where id=$17 and org_id=$18 returning *
  `, [next.name,next.module,next.purpose,next.provider,next.model_version,next.prompt_version,next.risk_tier,next.authority_level,next.owner,next.environment,next.status,next.data_access,next.human_approval_required,next.assurance_score,next.last_review_at,next.next_review_at,id,session.orgId]);
  await recordAuditEvent({ session, action: "ai_governance.system_updated", entityType: "ai_system", entityId: id, route: "/api/v1/admin/ai-governance", method: "PATCH", request: request || null, metadata: { before: { riskTier: existing.risk_tier, authority: existing.authority_level, status: existing.status }, after: { riskTier: updated.risk_tier, authority: updated.authority_level, status: updated.status } } });
  return updated;
}

export async function deleteAiSystem(session: ProtectedSession, id: string, request?: Request | null) {
  const existing = await assertSystem(session.orgId, id);
  await sql("delete from ai_systems where id=$1 and org_id=$2", [id, session.orgId]);
  await recordAuditEvent({ session, action: "ai_governance.system_deleted", entityType: "ai_system", entityId: id, route: "/api/v1/admin/ai-governance", method: "DELETE", request: request || null, metadata: { name: existing.name, status: existing.status } });
}

export async function upsertControl(session: ProtectedSession, input: Record<string, unknown>, request?: Request | null) {
  const systemId = required(input.system_id, "system_id", 120);
  await assertSystem(session.orgId, systemId);
  const layerKey = required(input.layer_key, "layer_key", 80);
  if (!layerKeys.has(layerKey as any)) throw new Error("AI_GOV_LAYER_INVALID");
  const controlName = required(input.control_name, "control_name", 180);
  const status = enumValue(input.status, controlStatuses, "control_status", "Not assessed");
  const id = `aic_${randomUUID()}`;
  const [item] = await sql<Row>(`
    insert into ai_governance_controls(id,org_id,system_id,layer_key,control_name,status,owner,evidence,last_reviewed_at,next_review_at,updated_at)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
    on conflict(org_id,system_id,layer_key,control_name) do update set
      status=excluded.status,owner=excluded.owner,evidence=excluded.evidence,last_reviewed_at=excluded.last_reviewed_at,next_review_at=excluded.next_review_at,updated_at=now()
    returning *
  `, [id,session.orgId,systemId,layerKey,controlName,status,clean(input.owner,180),clean(input.evidence,5000),optionalDate(input.last_reviewed_at,"last_reviewed_at"),optionalDate(input.next_review_at,"next_review_at")]);
  await recordAuditEvent({ session, action: "ai_governance.control_assessed", entityType: "ai_governance_control", entityId: item.id, route: "/api/v1/admin/ai-governance", method: "POST", request: request || null, metadata: { systemId, layerKey, controlName, status } });
  return item;
}

export async function createFinding(session: ProtectedSession, input: Record<string, unknown>, request?: Request | null) {
  const systemId = required(input.system_id, "system_id", 120);
  await assertSystem(session.orgId, systemId);
  const layerKey = required(input.layer_key, "layer_key", 80);
  if (!layerKeys.has(layerKey as any)) throw new Error("AI_GOV_LAYER_INVALID");
  const severity = enumValue(input.severity, findingSeverities, "finding_severity", "Moderate");
  const status = enumValue(input.status, findingStatuses, "finding_status", "Open");
  const id = `aif_${randomUUID()}`;
  const [item] = await sql<Row>(`
    insert into ai_governance_findings(id,org_id,system_id,layer_key,severity,title,description,status,owner,due_at,resolved_at,updated_at)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now()) returning *
  `, [id,session.orgId,systemId,layerKey,severity,required(input.title,"finding_title",240),clean(input.description,5000),status,clean(input.owner,180),optionalDate(input.due_at,"due_at"),status === "Resolved" ? new Date().toISOString() : null]);
  await recordAuditEvent({ session, action: "ai_governance.finding_created", entityType: "ai_governance_finding", entityId: id, route: "/api/v1/admin/ai-governance", method: "POST", request: request || null, metadata: { systemId, layerKey, severity, status, title: item.title } });
  return item;
}

export async function updateFinding(session: ProtectedSession, id: string, input: Record<string, unknown>, request?: Request | null) {
  const [existing] = await sql<Row>("select * from ai_governance_findings where id=$1 and org_id=$2 limit 1", [id, session.orgId]);
  if (!existing) throw new Error("AI_GOV_FINDING_NOT_FOUND");
  const status = Object.hasOwn(input,"status") ? enumValue(input.status,findingStatuses,"finding_status") : existing.status;
  const severity = Object.hasOwn(input,"severity") ? enumValue(input.severity,findingSeverities,"finding_severity") : existing.severity;
  const [item] = await sql<Row>(`
    update ai_governance_findings set severity=$1,title=$2,description=$3,status=$4,owner=$5,due_at=$6,
      resolved_at=case when $4='Resolved' then coalesce(resolved_at,now()) else null end,updated_at=now()
    where id=$7 and org_id=$8 returning *
  `, [severity,Object.hasOwn(input,"title") ? required(input.title,"finding_title",240) : existing.title,Object.hasOwn(input,"description") ? clean(input.description,5000) : existing.description,status,Object.hasOwn(input,"owner") ? clean(input.owner,180) : existing.owner,Object.hasOwn(input,"due_at") ? optionalDate(input.due_at,"due_at") : existing.due_at,id,session.orgId]);
  await recordAuditEvent({ session, action: "ai_governance.finding_updated", entityType: "ai_governance_finding", entityId: id, route: "/api/v1/admin/ai-governance", method: "PATCH", request: request || null, metadata: { before: { severity: existing.severity, status: existing.status }, after: { severity: item.severity, status: item.status } } });
  return item;
}

export async function recordEvaluation(session: ProtectedSession, input: Record<string, unknown>, request?: Request | null) {
  const systemId = required(input.system_id,"system_id",120);
  await assertSystem(session.orgId,systemId);
  const id = `aie_${randomUUID()}`;
  const evaluationScore = score(input.score,"evaluation_score");
  const [item] = await sql<Row>(`
    insert into ai_assurance_evaluations(id,org_id,system_id,evaluation_type,score,status,notes,reviewed_by)
    values($1,$2,$3,$4,$5,$6,$7,$8) returning *
  `,[id,session.orgId,systemId,required(input.evaluation_type,"evaluation_type",180),evaluationScore,clean(input.status,80) || "Completed",clean(input.notes,5000),clean(input.reviewed_by,180) || session.email || null]);
  if (evaluationScore !== null) await sql("update ai_systems set assurance_score=$1,last_review_at=current_date,updated_at=now() where id=$2 and org_id=$3",[evaluationScore,systemId,session.orgId]);
  await recordAuditEvent({ session, action: "ai_governance.evaluation_recorded", entityType: "ai_assurance_evaluation", entityId: id, route: "/api/v1/admin/ai-governance", method: "POST", request: request || null, metadata: { systemId, evaluationType: item.evaluation_type, score: evaluationScore } });
  return item;
}

export async function recordDecision(session: ProtectedSession, input: Record<string, unknown>, request?: Request | null) {
  const systemId = required(input.system_id,"system_id",120);
  const system = await assertSystem(session.orgId,systemId);
  const authority = enumValue(input.authority_level,authorityLevels,"authority_level",String(system.authority_level || "Recommend"));
  const confidence = score(input.confidence,"confidence");
  const id = `aid_${randomUUID()}`;
  const inputSources = Array.isArray(input.input_sources) ? input.input_sources.map(value => String(value).slice(0,500)).slice(0,50) : String(input.input_sources || "").split(/\n|,/).map(value => value.trim()).filter(Boolean).slice(0,50);
  const [item] = await sql<Row>(`
    insert into ai_decision_records(
      id,org_id,system_id,model_version,prompt_version,authority_level,input_sources,output_summary,confidence,policy_result,human_reviewer,override_status,final_action
    ) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13) returning *
  `,[id,session.orgId,systemId,clean(input.model_version,160) || system.model_version,clean(input.prompt_version,160) || system.prompt_version,authority,JSON.stringify(inputSources),required(input.output_summary,"output_summary",5000),confidence,clean(input.policy_result,500),clean(input.human_reviewer,180),clean(input.override_status,160),clean(input.final_action,1000)]);
  await recordAuditEvent({ session, action: "ai_governance.decision_recorded", entityType: "ai_decision_record", entityId: id, route: "/api/v1/admin/ai-governance", method: "POST", request: request || null, metadata: { systemId, authority, confidence, humanReviewer: item.human_reviewer || null } });
  return item;
}

export async function deleteDecision(session: ProtectedSession, id: string, request?: Request | null) {
  const [existing] = await sql<Row>("select id,system_id from ai_decision_records where id=$1 and org_id=$2 limit 1",[id,session.orgId]);
  if (!existing) throw new Error("AI_GOV_DECISION_NOT_FOUND");
  await sql("delete from ai_decision_records where id=$1 and org_id=$2",[id,session.orgId]);
  await recordAuditEvent({ session, action: "ai_governance.decision_deleted", entityType: "ai_decision_record", entityId: id, route: "/api/v1/admin/ai-governance", method: "DELETE", request: request || null, metadata: { systemId: existing.system_id } });
}
