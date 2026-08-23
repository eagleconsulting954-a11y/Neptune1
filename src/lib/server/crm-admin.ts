import { randomUUID } from "crypto";
import type { ProtectedSession } from "@/src/lib/server/auth";
import { sql, type Row } from "@/src/lib/server/db";
import { recordAuditEvent } from "@/src/lib/server/security";

export const CRM_STAGES = [
  { name: "Lead", probability: 10 },
  { name: "Qualified", probability: 30 },
  { name: "Demo booked", probability: 45 },
  { name: "Proposal", probability: 65 },
  { name: "Negotiation", probability: 80 },
  { name: "Won", probability: 100 },
  { name: "Lost", probability: 0 }
] as const;

export type CrmStage = (typeof CRM_STAGES)[number]["name"];

const CRM_STAGE_NAMES = new Set(CRM_STAGES.map(stage => stage.name));
const CRM_FIELDS = [
  "company",
  "contact",
  "contact_title",
  "email",
  "phone",
  "stage",
  "annual_value",
  "currency",
  "probability",
  "owner",
  "source",
  "expected_close_at",
  "next_action",
  "next_action_at",
  "last_contact_at",
  "notes",
  "lost_reason"
] as const;

let crmSchemaReady: Promise<void> | null = null;

export async function ensureCrmSchema() {
  if (crmSchemaReady) return crmSchemaReady;
  crmSchemaReady = (async () => {
    await sql(`
      alter table crm_accounts add column if not exists contact_title text;
      alter table crm_accounts add column if not exists phone text;
      alter table crm_accounts add column if not exists owner text;
      alter table crm_accounts add column if not exists source text;
      alter table crm_accounts add column if not exists probability int not null default 30;
      alter table crm_accounts add column if not exists currency text not null default 'USD';
      alter table crm_accounts add column if not exists expected_close_at date;
      alter table crm_accounts add column if not exists next_action text;
      alter table crm_accounts add column if not exists next_action_at timestamptz;
      alter table crm_accounts add column if not exists last_contact_at timestamptz;
      alter table crm_accounts add column if not exists notes text;
      alter table crm_accounts add column if not exists lost_reason text;
      alter table crm_accounts add column if not exists stage_changed_at timestamptz not null default now();
      alter table crm_accounts add column if not exists updated_at timestamptz not null default now();

      update crm_accounts
      set probability=case lower(coalesce(stage,''))
        when 'lead' then 10
        when 'qualified' then 30
        when 'demo booked' then 45
        when 'proposal' then 65
        when 'negotiation' then 80
        when 'won' then 100
        when 'lost' then 0
        else probability
      end
      where probability is null or probability=30;

      create index if not exists idx_crm_accounts_org_stage on crm_accounts(org_id,stage);
      create index if not exists idx_crm_accounts_org_owner on crm_accounts(org_id,owner);
      create index if not exists idx_crm_accounts_org_close on crm_accounts(org_id,expected_close_at);
      create index if not exists idx_crm_accounts_org_followup on crm_accounts(org_id,next_action_at);
      insert into schema_migrations(id) values('20260823_008_enterprise_crm_pipeline') on conflict(id) do nothing;
    `);
  })().catch(error => {
    crmSchemaReady = null;
    throw error;
  });
  return crmSchemaReady;
}

function cleanString(value: unknown, max: number) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

function requiredString(value: unknown, field: string, max: number) {
  const text = cleanString(value, max);
  if (!text) throw new Error(`CRM_${field.toUpperCase()}_REQUIRED`);
  return text;
}

function optionalEmail(value: unknown) {
  const email = cleanString(value, 320);
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("CRM_EMAIL_INVALID");
  return email.toLowerCase();
}

function numeric(value: unknown, field: string, min: number, max: number) {
  if (value === undefined || value === null || value === "") return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < min || amount > max) throw new Error(`CRM_${field.toUpperCase()}_INVALID`);
  return amount;
}

function dateOnly(value: unknown, field: string) {
  const text = cleanString(value, 32);
  if (!text) return null;
  const parsed = new Date(`${text.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error(`CRM_${field.toUpperCase()}_INVALID`);
  return text.slice(0, 10);
}

function dateTime(value: unknown, field: string) {
  const text = cleanString(value, 64);
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) throw new Error(`CRM_${field.toUpperCase()}_INVALID`);
  return parsed.toISOString();
}

export function stageProbability(stage: string) {
  return CRM_STAGES.find(item => item.name === stage)?.probability ?? 30;
}

function normalizeStage(value: unknown, fallback: CrmStage = "Qualified") {
  const stage = cleanString(value, 40) || fallback;
  if (!CRM_STAGE_NAMES.has(stage as CrmStage)) throw new Error("CRM_STAGE_INVALID");
  return stage as CrmStage;
}

function sanitizeCreate(input: Record<string, unknown>) {
  const stage = normalizeStage(input.stage);
  const explicitProbability = numeric(input.probability, "probability", 0, 100);
  return {
    company: requiredString(input.company, "company", 180),
    contact: cleanString(input.contact, 160),
    contact_title: cleanString(input.contact_title, 160),
    email: optionalEmail(input.email),
    phone: cleanString(input.phone, 80),
    stage,
    annual_value: numeric(input.annual_value, "annual_value", 0, 1_000_000_000_000) ?? 0,
    currency: (cleanString(input.currency, 3) || "USD").toUpperCase(),
    probability: stage === "Won" ? 100 : stage === "Lost" ? 0 : explicitProbability ?? stageProbability(stage),
    owner: cleanString(input.owner, 160),
    source: cleanString(input.source, 160),
    expected_close_at: dateOnly(input.expected_close_at, "expected_close_at"),
    next_action: cleanString(input.next_action, 500),
    next_action_at: dateTime(input.next_action_at, "next_action_at"),
    last_contact_at: dateTime(input.last_contact_at, "last_contact_at"),
    notes: cleanString(input.notes, 5000),
    lost_reason: stage === "Lost" ? cleanString(input.lost_reason, 1000) : null
  };
}

function sanitizePatch(input: Record<string, unknown>, existing: Row) {
  const patch: Record<string, unknown> = {};
  for (const field of CRM_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(input, field)) continue;
    if (field === "company") patch.company = requiredString(input.company, "company", 180);
    else if (field === "contact") patch.contact = cleanString(input.contact, 160);
    else if (field === "contact_title") patch.contact_title = cleanString(input.contact_title, 160);
    else if (field === "email") patch.email = optionalEmail(input.email);
    else if (field === "phone") patch.phone = cleanString(input.phone, 80);
    else if (field === "stage") patch.stage = normalizeStage(input.stage, normalizeStage(existing.stage));
    else if (field === "annual_value") patch.annual_value = numeric(input.annual_value, "annual_value", 0, 1_000_000_000_000) ?? 0;
    else if (field === "currency") patch.currency = (cleanString(input.currency, 3) || "USD").toUpperCase();
    else if (field === "probability") patch.probability = numeric(input.probability, "probability", 0, 100) ?? stageProbability(String(existing.stage || "Qualified"));
    else if (field === "owner") patch.owner = cleanString(input.owner, 160);
    else if (field === "source") patch.source = cleanString(input.source, 160);
    else if (field === "expected_close_at") patch.expected_close_at = dateOnly(input.expected_close_at, "expected_close_at");
    else if (field === "next_action") patch.next_action = cleanString(input.next_action, 500);
    else if (field === "next_action_at") patch.next_action_at = dateTime(input.next_action_at, "next_action_at");
    else if (field === "last_contact_at") patch.last_contact_at = dateTime(input.last_contact_at, "last_contact_at");
    else if (field === "notes") patch.notes = cleanString(input.notes, 5000);
    else if (field === "lost_reason") patch.lost_reason = cleanString(input.lost_reason, 1000);
  }

  const nextStage = String(patch.stage || existing.stage || "Qualified");
  if (patch.stage && patch.stage !== existing.stage) {
    patch.stage_changed_at = new Date().toISOString();
    if (!Object.prototype.hasOwnProperty.call(input, "probability")) patch.probability = stageProbability(nextStage);
  }
  if (nextStage === "Won") {
    patch.probability = 100;
    patch.lost_reason = null;
  } else if (nextStage === "Lost") {
    patch.probability = 0;
  } else if (Object.prototype.hasOwnProperty.call(patch, "lost_reason")) {
    patch.lost_reason = null;
  }
  patch.updated_at = new Date().toISOString();
  return patch;
}

function auditSnapshot(row: Row | null | undefined) {
  if (!row) return null;
  return {
    company: row.company || null,
    stage: row.stage || null,
    annualValue: Number(row.annual_value || 0),
    probability: Number(row.probability ?? stageProbability(String(row.stage || "Qualified"))),
    owner: row.owner || null,
    source: row.source || null,
    expectedCloseAt: row.expected_close_at || null,
    nextActionAt: row.next_action_at || null
  };
}

export async function listCrmAccounts(orgId: string) {
  await ensureCrmSchema();
  return sql<Row>(`
    select id,org_id,company,contact,contact_title,email,phone,stage,annual_value,currency,probability,
           owner,source,expected_close_at,next_action,next_action_at,last_contact_at,notes,lost_reason,
           stage_changed_at,updated_at,created_at
    from crm_accounts
    where org_id=$1
    order by case lower(coalesce(stage,'')) when 'won' then 1 when 'lost' then 2 else 0 end,
             coalesce(next_action_at,expected_close_at::timestamptz,created_at) asc,
             created_at desc
  `, [orgId]);
}

export async function createCrmAccount(session: ProtectedSession, input: Record<string, unknown>, request?: Request | null) {
  await ensureCrmSchema();
  const values = sanitizeCreate(input);
  const id = `crm_${randomUUID()}`;
  const [item] = await sql<Row>(`
    insert into crm_accounts(
      id,org_id,company,contact,contact_title,email,phone,stage,annual_value,currency,probability,
      owner,source,expected_close_at,next_action,next_action_at,last_contact_at,notes,lost_reason,
      stage_changed_at,updated_at
    ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,now(),now())
    returning *
  `, [
    id,session.orgId,values.company,values.contact,values.contact_title,values.email,values.phone,values.stage,
    values.annual_value,values.currency,values.probability,values.owner,values.source,values.expected_close_at,
    values.next_action,values.next_action_at,values.last_contact_at,values.notes,values.lost_reason
  ]);
  await recordAuditEvent({
    session,
    action: "crm.opportunity_created",
    entityType: "crm_accounts",
    entityId: id,
    route: "/api/v1/admin/crm",
    method: "POST",
    request: request || null,
    metadata: { after: auditSnapshot(item) }
  });
  return item;
}

export async function updateCrmAccount(session: ProtectedSession, id: string, input: Record<string, unknown>, request?: Request | null) {
  await ensureCrmSchema();
  const [existing] = await sql<Row>("select * from crm_accounts where id=$1 and org_id=$2 limit 1", [id, session.orgId]);
  if (!existing) throw new Error("CRM_NOT_FOUND");
  const patch = sanitizePatch(input, existing);
  const entries = Object.entries(patch);
  if (!entries.length) throw new Error("CRM_NO_CHANGES");
  const setSql = entries.map(([key], index) => `${key}=$${index + 1}`).join(",");
  const params = entries.map(([, value]) => value);
  params.push(id, session.orgId);
  const [item] = await sql<Row>(
    `update crm_accounts set ${setSql} where id=$${entries.length + 1} and org_id=$${entries.length + 2} returning *`,
    params
  );
  await recordAuditEvent({
    session,
    action: existing.stage !== item.stage ? "crm.stage_changed" : "crm.opportunity_updated",
    entityType: "crm_accounts",
    entityId: id,
    route: "/api/v1/admin/crm",
    method: "PATCH",
    request: request || null,
    metadata: {
      changedFields: entries.map(([key]) => key).filter(key => !["updated_at","stage_changed_at"].includes(key)),
      before: auditSnapshot(existing),
      after: auditSnapshot(item)
    }
  });
  return item;
}

export async function deleteCrmAccount(session: ProtectedSession, id: string, request?: Request | null) {
  await ensureCrmSchema();
  const [existing] = await sql<Row>("select * from crm_accounts where id=$1 and org_id=$2 limit 1", [id, session.orgId]);
  if (!existing) throw new Error("CRM_NOT_FOUND");
  await sql("delete from crm_accounts where id=$1 and org_id=$2", [id, session.orgId]);
  await recordAuditEvent({
    session,
    action: "crm.opportunity_deleted",
    entityType: "crm_accounts",
    entityId: id,
    route: "/api/v1/admin/crm",
    method: "DELETE",
    request: request || null,
    metadata: { before: auditSnapshot(existing) }
  });
  return true;
}

export async function listAdminAudit(orgId: string, limit = 20) {
  await ensureCrmSchema();
  return sql<Row>(`
    select id,user_email,action,entity_type,entity_id,metadata,created_at
    from audit_events
    where org_id=$1
    order by created_at desc
    limit $2
  `, [orgId, Math.max(1, Math.min(limit, 100))]);
}

export function buildCrmAnalytics(accounts: Row[]) {
  const active = accounts.filter(account => !["won","lost"].includes(String(account.stage || "").toLowerCase()));
  const won = accounts.filter(account => String(account.stage || "").toLowerCase() === "won");
  const lost = accounts.filter(account => String(account.stage || "").toLowerCase() === "lost");
  const activePipeline = active.reduce((sum, account) => sum + Number(account.annual_value || 0), 0);
  const weightedPipeline = active.reduce((sum, account) => sum + Number(account.annual_value || 0) * Number(account.probability ?? stageProbability(String(account.stage || "Qualified"))) / 100, 0);
  const wonValue = won.reduce((sum, account) => sum + Number(account.annual_value || 0), 0);
  const lostValue = lost.reduce((sum, account) => sum + Number(account.annual_value || 0), 0);
  const closedCount = won.length + lost.length;
  const conversionRate = closedCount ? won.length / closedCount * 100 : 0;
  const now = Date.now();
  const fourteenDaysAgo = now - 14 * 86_400_000;
  const stale = active.filter(account => {
    const reference = account.last_contact_at || account.created_at;
    const time = reference ? new Date(reference).getTime() : NaN;
    return Number.isFinite(time) && time < fourteenDaysAgo;
  });
  const overdue = active.filter(account => account.next_action_at && new Date(account.next_action_at).getTime() < now);
  const closing30 = active.filter(account => {
    if (!account.expected_close_at) return false;
    const close = new Date(`${String(account.expected_close_at).slice(0, 10)}T23:59:59Z`).getTime();
    return close >= now && close <= now + 30 * 86_400_000;
  });

  const stageMap = new Map<string, { count: number; value: number; weighted: number }>();
  for (const definition of CRM_STAGES) stageMap.set(definition.name, { count: 0, value: 0, weighted: 0 });
  for (const account of accounts) {
    const stage = String(account.stage || "Qualified");
    const current = stageMap.get(stage) || { count: 0, value: 0, weighted: 0 };
    const value = Number(account.annual_value || 0);
    const probability = Number(account.probability ?? stageProbability(stage));
    current.count += 1;
    current.value += value;
    current.weighted += value * probability / 100;
    stageMap.set(stage, current);
  }

  const ownerMap = new Map<string, { count: number; value: number; weighted: number }>();
  for (const account of active) {
    const owner = String(account.owner || "Unassigned");
    const current = ownerMap.get(owner) || { count: 0, value: 0, weighted: 0 };
    const value = Number(account.annual_value || 0);
    current.count += 1;
    current.value += value;
    current.weighted += value * Number(account.probability ?? stageProbability(String(account.stage || "Qualified"))) / 100;
    ownerMap.set(owner, current);
  }

  const sourceMap = new Map<string, { count: number; value: number }>();
  for (const account of accounts) {
    const source = String(account.source || "Unspecified");
    const current = sourceMap.get(source) || { count: 0, value: 0 };
    current.count += 1;
    current.value += Number(account.annual_value || 0);
    sourceMap.set(source, current);
  }

  const forecast = [30, 60, 90].map(days => {
    const cutoff = now + days * 86_400_000;
    const rows = active.filter(account => account.expected_close_at && new Date(`${String(account.expected_close_at).slice(0,10)}T23:59:59Z`).getTime() <= cutoff);
    return {
      days,
      value: Math.round(rows.reduce((sum, account) => sum + Number(account.annual_value || 0), 0)),
      weighted: Math.round(rows.reduce((sum, account) => sum + Number(account.annual_value || 0) * Number(account.probability ?? stageProbability(String(account.stage || "Qualified"))) / 100, 0))
    };
  });

  return {
    summary: {
      accounts: accounts.length,
      activeOpportunities: active.length,
      pipeline: Math.round(activePipeline),
      weightedPipeline: Math.round(weightedPipeline),
      averageDeal: active.length ? Math.round(activePipeline / active.length) : 0,
      wonValue: Math.round(wonValue),
      lostValue: Math.round(lostValue),
      conversionRate: Number(conversionRate.toFixed(1)),
      staleOpportunities: stale.length,
      overdueFollowUps: overdue.length,
      closing30Days: closing30.length
    },
    stages: Array.from(stageMap.entries()).map(([name, value]) => ({ name, ...value })),
    owners: Array.from(ownerMap.entries()).map(([name, value]) => ({ name, ...value })).sort((a,b) => b.weighted - a.weighted),
    sources: Array.from(sourceMap.entries()).map(([name, value]) => ({ name, ...value })).sort((a,b) => b.value - a.value),
    forecast,
    alerts: {
      overdue: overdue.map(account => account.id),
      stale: stale.map(account => account.id),
      closing30: closing30.map(account => account.id)
    }
  };
}
