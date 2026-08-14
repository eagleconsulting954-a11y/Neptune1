import { createHash, randomUUID } from "crypto";
import type { Session } from "@/src/lib/server/auth";
import { sql, type Row } from "@/src/lib/server/db";
import { allowedVesselIds, canManageOrganization } from "@/src/lib/server/org-access";
import { recordAuditEvent } from "@/src/lib/server/security";

const DECISIONS = new Set(["approve", "reject", "request_changes", "acknowledge"]);
const REQUEST_STATUSES = new Set(["pending", "approved", "rejected", "changes_requested", "acknowledged", "closed"]);

export async function ensureApprovalSchema() {
  await sql(`
    create table if not exists approval_requests (
      id text primary key,
      org_id text not null references organizations(id) on delete cascade,
      vessel_id text references vessels(id) on delete set null,
      resource_type text,
      resource_id text,
      title text not null,
      description text,
      status text not null default 'pending',
      required_role text,
      requested_by text references users(id) on delete set null,
      due_at timestamptz,
      revision int not null default 1,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index if not exists idx_approval_requests_org on approval_requests(org_id,status,created_at desc);
    create index if not exists idx_approval_requests_vessel on approval_requests(org_id,vessel_id,status);

    create table if not exists approval_actions (
      id text primary key,
      request_id text not null references approval_requests(id) on delete cascade,
      org_id text not null references organizations(id) on delete cascade,
      actor_user_id text references users(id) on delete set null,
      actor_email text,
      actor_role text,
      decision text not null,
      comment text,
      revision int not null,
      acknowledgment_hash text not null,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_approval_actions_request on approval_actions(request_id,created_at asc);

    create or replace function neptune_prevent_approval_action_mutation() returns trigger as $$
    begin
      raise exception 'approval_actions are append-only';
    end;
    $$ language plpgsql;

    do $$
    begin
      if not exists (select 1 from pg_trigger where tgname='trg_neptune_approval_actions_immutable') then
        create trigger trg_neptune_approval_actions_immutable
        before update or delete on approval_actions
        for each row execute function neptune_prevent_approval_action_mutation();
      end if;
    end $$;
  `);
}

function clean(value: unknown, max: number) {
  return String(value || "").trim().slice(0, max);
}

function normalizedRole(value: unknown) {
  return clean(value, 80).toLowerCase().replaceAll(" ", "_");
}

async function assertVesselPermission(session: Pick<Session, "userId" | "orgId" | "role" | "email">, vesselId: string | null, edit = false) {
  if (!vesselId) return;
  const allowed = await allowedVesselIds(session, edit);
  if (allowed !== null && !allowed.has(vesselId)) throw new Error("VESSEL_PERMISSION_REQUIRED");
}

function canSign(session: Pick<Session, "role" | "email">, requiredRole: unknown) {
  if (canManageOrganization(session)) return true;
  const required = normalizedRole(requiredRole);
  if (!required) return true;
  const role = normalizedRole(session.role);
  if (required === "master") return ["captain", "master"].includes(role);
  if (required === "manager") return canManageOrganization(session);
  return role === required;
}

function acknowledgmentHash(input: { requestId: string; revision: number; decision: string; actorEmail?: string; comment?: string }) {
  return createHash("sha256").update([
    input.requestId,
    String(input.revision),
    input.decision,
    String(input.actorEmail || "").toLowerCase(),
    input.comment || ""
  ].join("|")).digest("hex");
}

export async function listApprovalRequests(session: Pick<Session, "userId" | "orgId" | "role" | "email">, limit = 200) {
  await ensureApprovalSchema();
  const rows = await sql<Row>(`
    select r.*,
      coalesce(jsonb_agg(jsonb_build_object(
        'id',a.id,'decision',a.decision,'comment',a.comment,'actorEmail',a.actor_email,
        'actorRole',a.actor_role,'revision',a.revision,'acknowledgmentHash',a.acknowledgment_hash,
        'createdAt',a.created_at
      ) order by a.created_at asc) filter (where a.id is not null),'[]'::jsonb) as actions
    from approval_requests r
    left join approval_actions a on a.request_id=r.id
    where r.org_id=$1
    group by r.id
    order by r.created_at desc
    limit $2
  `, [session.orgId, Math.max(1, Math.min(500, limit))]);
  const allowed = await allowedVesselIds(session, false);
  return allowed === null ? rows : rows.filter(row => !row.vessel_id || allowed.has(String(row.vessel_id)));
}

export async function createApprovalRequest(input: {
  session: Pick<Session, "userId" | "orgId" | "role" | "email">;
  vesselId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  title: string;
  description?: string | null;
  requiredRole?: string | null;
  dueAt?: string | null;
  request?: Request | null;
}) {
  await ensureApprovalSchema();
  const title = clean(input.title, 240);
  if (!title) throw new Error("APPROVAL_TITLE_REQUIRED");
  const vesselId = clean(input.vesselId, 120) || null;
  await assertVesselPermission(input.session, vesselId, true);
  const id = `approval_${randomUUID()}`;
  const [created] = await sql<Row>(`
    insert into approval_requests(
      id,org_id,vessel_id,resource_type,resource_id,title,description,status,required_role,requested_by,due_at
    ) values($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9,$10) returning *
  `, [
    id,
    input.session.orgId,
    vesselId,
    clean(input.resourceType, 100) || null,
    clean(input.resourceId, 180) || null,
    title,
    clean(input.description, 4000) || null,
    clean(input.requiredRole, 80) || null,
    input.session.userId,
    input.dueAt || null
  ]);
  await recordAuditEvent({ session: input.session, action: "approval.request_created", entityType: "approval_request", entityId: id, route: "/api/v1/approvals", method: "POST", request: input.request, metadata: { vesselId, requiredRole: input.requiredRole || null } });
  return created;
}

export async function signApproval(input: {
  session: Pick<Session, "userId" | "orgId" | "role" | "email">;
  requestId: string;
  decision: string;
  comment?: string | null;
  acknowledgment: string;
  request?: Request | null;
}) {
  await ensureApprovalSchema();
  const decision = normalizedRole(input.decision);
  if (!DECISIONS.has(decision)) throw new Error("APPROVAL_DECISION_INVALID");
  const [approval] = await sql<Row>("select * from approval_requests where id=$1 and org_id=$2 limit 1", [input.requestId, input.session.orgId]);
  if (!approval) throw new Error("APPROVAL_NOT_FOUND");
  await assertVesselPermission(input.session, approval.vessel_id ? String(approval.vessel_id) : null, false);
  if (!canSign(input.session, approval.required_role)) throw new Error("APPROVAL_ROLE_REQUIRED");
  if (["approved", "rejected", "closed"].includes(String(approval.status))) throw new Error("APPROVAL_ALREADY_FINAL");
  const acknowledgment = clean(input.acknowledgment, 240);
  if (acknowledgment.toLowerCase() !== "i acknowledge this action") throw new Error("APPROVAL_ACKNOWLEDGMENT_REQUIRED");
  const comment = clean(input.comment, 4000) || null;
  const revision = Number(approval.revision || 1);
  const hash = acknowledgmentHash({ requestId: approval.id, revision, decision, actorEmail: input.session.email, comment: comment || undefined });
  const actionId = `approval_action_${randomUUID()}`;
  await sql(`
    insert into approval_actions(id,request_id,org_id,actor_user_id,actor_email,actor_role,decision,comment,revision,acknowledgment_hash)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  `, [actionId, approval.id, input.session.orgId, input.session.userId, input.session.email || null, input.session.role, decision, comment, revision, hash]);

  const nextStatus = decision === "approve" ? "approved"
    : decision === "reject" ? "rejected"
    : decision === "request_changes" ? "changes_requested"
    : "acknowledged";
  if (!REQUEST_STATUSES.has(nextStatus)) throw new Error("APPROVAL_STATUS_INVALID");
  const [updated] = await sql<Row>("update approval_requests set status=$1,updated_at=now() where id=$2 and org_id=$3 returning *", [nextStatus, approval.id, input.session.orgId]);
  await recordAuditEvent({ session: input.session, action: `approval.${decision}`, entityType: "approval_request", entityId: approval.id, route: "/api/v1/approvals", method: "PATCH", request: input.request, metadata: { acknowledgmentHash: hash, revision } });
  return { request: updated, action: { id: actionId, decision, comment, revision, acknowledgmentHash: hash } };
}

export async function reviseApproval(input: {
  session: Pick<Session, "userId" | "orgId" | "role" | "email">;
  requestId: string;
  description?: string | null;
  dueAt?: string | null;
  request?: Request | null;
}) {
  await ensureApprovalSchema();
  const [approval] = await sql<Row>("select * from approval_requests where id=$1 and org_id=$2 limit 1", [input.requestId, input.session.orgId]);
  if (!approval) throw new Error("APPROVAL_NOT_FOUND");
  await assertVesselPermission(input.session, approval.vessel_id ? String(approval.vessel_id) : null, true);
  if (!canManageOrganization(input.session) && String(approval.requested_by || "") !== input.session.userId) throw new Error("APPROVAL_EDIT_REQUIRED");
  const [updated] = await sql<Row>(`
    update approval_requests set
      description=coalesce($1,description),
      due_at=coalesce($2,due_at),
      status='pending',
      revision=revision+1,
      updated_at=now()
    where id=$3 and org_id=$4 returning *
  `, [input.description === undefined ? null : clean(input.description, 4000), input.dueAt || null, approval.id, input.session.orgId]);
  await recordAuditEvent({ session: input.session, action: "approval.revised", entityType: "approval_request", entityId: approval.id, route: "/api/v1/approvals", method: "PUT", request: input.request, metadata: { revision: updated.revision } });
  return updated;
}
