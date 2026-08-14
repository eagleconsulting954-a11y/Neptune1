import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "crypto";
import type { Session } from "@/src/lib/server/auth";
import { isDesignatedAdminEmail } from "@/src/lib/server/admin-access";
import { findUserByEmail, sql, type ResourceName, type Row } from "@/src/lib/server/db";
import { recordAuditEvent, revokeAllAuthSessions, secureHash } from "@/src/lib/server/security";

const MANAGER_ROLES = new Set(["admin", "owner", "org_admin", "fleet_manager"]);
const ALLOWED_ROLES = new Set(["member", "captain", "chief_engineer", "safety_officer", "fleet_manager", "org_admin"]);
const VESSEL_RESOURCES = new Set<ResourceName>(["duties", "work_orders", "certificates", "incidents", "bunker_plans"]);

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function inviteHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function canManageOrganization(session: Pick<Session, "role" | "email">) {
  return isDesignatedAdminEmail(session.email) || MANAGER_ROLES.has(String(session.role || "").toLowerCase());
}

export function assertOrganizationManager(session: Pick<Session, "role" | "email">) {
  if (!canManageOrganization(session)) throw new Error("ORG_MANAGER_REQUIRED");
}

function unrestrictedVesselAccess(session: Pick<Session, "role" | "email">) {
  return canManageOrganization(session);
}

export async function allowedVesselIds(session: Pick<Session, "userId" | "orgId" | "role" | "email">, edit = false) {
  if (unrestrictedVesselAccess(session)) return null;
  const rows = await sql<Row>(`
    select vessel_id from user_vessel_permissions
    where user_id=$1 and org_id=$2 and can_view=true ${edit ? "and can_edit=true" : ""}
  `, [session.userId, session.orgId]);
  return new Set(rows.map(row => String(row.vessel_id)));
}

export async function scopeResourceRows(session: Pick<Session, "userId" | "orgId" | "role" | "email">, resource: ResourceName, rows: Row[]) {
  const allowed = await allowedVesselIds(session, false);
  if (allowed === null) return rows;
  if (resource === "vessels") return rows.filter(row => allowed.has(String(row.id)));
  if (VESSEL_RESOURCES.has(resource)) return rows.filter(row => row.vessel_id && allowed.has(String(row.vessel_id)));
  return rows;
}

export async function assertResourceWriteAccess(
  session: Pick<Session, "userId" | "orgId" | "role" | "email">,
  resource: ResourceName,
  input: Row,
  existing?: Row | null
) {
  const allowed = await allowedVesselIds(session, true);
  if (allowed === null) return;
  if (resource === "vessels") {
    const id = String(existing?.id || input.id || "");
    if (!id || !allowed.has(id)) throw new Error("VESSEL_PERMISSION_REQUIRED");
    return;
  }
  if (VESSEL_RESOURCES.has(resource)) {
    const vesselId = String(input.vessel_id || existing?.vessel_id || "");
    if (!vesselId || !allowed.has(vesselId)) throw new Error("VESSEL_PERMISSION_REQUIRED");
  }
}

export async function scopeDashboardForSession(session: Pick<Session, "userId" | "orgId" | "role" | "email">, data: Row) {
  const allowed = await allowedVesselIds(session, false);
  if (allowed === null) return data;
  const vesselRows = (data.vessels || []).filter((row: Row) => allowed.has(String(row.id)));
  const byVessel = (rows: Row[]) => (rows || []).filter(row => row.vessel_id && allowed.has(String(row.vessel_id)));
  return {
    ...data,
    vessels: vesselRows,
    duties: byVessel(data.duties || []),
    workOrders: byVessel(data.workOrders || []),
    certificates: byVessel(data.certificates || []),
    incidents: byVessel(data.incidents || []),
    bunkerPlans: byVessel(data.bunkerPlans || [])
  };
}

export async function getOrganizationProfile(orgId: string) {
  const [org] = await sql<Row>("select id,name,plan,status,created_at,updated_at from organizations where id=$1", [orgId]);
  return org || null;
}

export async function updateOrganizationProfile(session: Pick<Session, "userId" | "orgId" | "role" | "email">, name: string) {
  assertOrganizationManager(session);
  const clean = name.trim().slice(0, 160);
  if (!clean) throw new Error("ORGANIZATION_NAME_REQUIRED");
  const [updated] = await sql<Row>("update organizations set name=$1,updated_at=now() where id=$2 returning id,name,plan,status,created_at,updated_at", [clean, session.orgId]);
  return updated || null;
}

export async function listOrganizationUsers(orgId: string) {
  return sql<Row>(`
    select
      u.id,u.name,u.email,u.role,u.email_verified_at,u.is_active,u.mfa_enabled,u.last_login_at,u.created_at,
      coalesce(
        jsonb_agg(jsonb_build_object('vesselId',p.vessel_id,'canView',p.can_view,'canEdit',p.can_edit))
        filter (where p.vessel_id is not null),
        '[]'::jsonb
      ) as vessel_permissions
    from users u
    left join user_vessel_permissions p on p.user_id=u.id and p.org_id=u.org_id
    where u.org_id=$1
    group by u.id
    order by u.created_at asc
  `, [orgId]);
}

export async function listOrganizationInvitations(orgId: string) {
  return sql<Row>(`
    select id,email,role,vessel_ids,expires_at,accepted_at,revoked_at,created_at
    from user_invitations where org_id=$1 order by created_at desc limit 100
  `, [orgId]);
}

async function validateVesselIds(orgId: string, vesselIds: string[]) {
  const unique = Array.from(new Set(vesselIds.map(String).filter(Boolean))).slice(0, 500);
  if (!unique.length) return [];
  const rows = await sql<Row>("select id from vessels where org_id=$1 and id=any($2::text[])", [orgId, unique]);
  if (rows.length !== unique.length) throw new Error("INVALID_VESSEL_PERMISSION");
  return unique;
}

async function replaceVesselPermissions(orgId: string, userId: string, vesselIds: string[], canEdit = false) {
  const valid = await validateVesselIds(orgId, vesselIds);
  await sql("delete from user_vessel_permissions where org_id=$1 and user_id=$2", [orgId, userId]);
  for (const vesselId of valid) {
    await sql(`
      insert into user_vessel_permissions(user_id,vessel_id,org_id,can_view,can_edit)
      values($1,$2,$3,true,$4)
    `, [userId, vesselId, orgId, canEdit]);
  }
  return valid;
}

function securitySender() {
  return String(process.env.SECURITY_FROM_EMAIL || process.env.PASSWORD_RESET_FROM_EMAIL || "Neptune <onboarding@resend.dev>").trim();
}

async function sendInvitationEmail(input: { to: string; inviter: string; organization: string; inviteUrl: string; role: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("EMAIL_NOT_CONFIGURED");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": `neptune-invite-${secureHash(`${input.to}|${input.inviteUrl}`, "invite-email").slice(0, 32)}`
    },
    body: JSON.stringify({
      from: securitySender(),
      to: [input.to],
      subject: `You were invited to ${input.organization} on Neptune`,
      text: `${input.inviter} invited you to ${input.organization} on Neptune as ${input.role}. Accept within 72 hours: ${input.inviteUrl}`,
      html: `<div style="background:#07111e;padding:32px;font-family:Arial,sans-serif;color:#eaf1f8"><div style="max-width:620px;margin:auto;background:#0c1929;border:1px solid #26384d;border-radius:22px;padding:30px"><div style="font-size:12px;letter-spacing:.18em;color:#e4bb5f;font-weight:700">NEPTUNE · SECURE ORGANIZATION INVITE</div><h1>Join ${input.organization}</h1><p>${input.inviter} invited you with the role <b>${input.role}</b>.</p><p><a href="${input.inviteUrl.replace(/"/g, "%22")}" style="display:inline-block;background:#e4bb5f;color:#07111e;text-decoration:none;font-weight:800;padding:14px 20px;border-radius:12px">Accept invitation</a></p><p style="color:#8fa1b5;font-size:13px">This one-time invitation expires in 72 hours.</p></div></div>`,
      tags: [{ name: "category", value: "organization-invite" }]
    }),
    signal: AbortSignal.timeout(15_000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`EMAIL_DELIVERY_FAILED:${response.status}:${JSON.stringify(result).slice(0, 500)}`);
}

export async function createOrganizationInvitation(input: {
  session: Pick<Session, "userId" | "orgId" | "role" | "email">;
  email: string;
  role: string;
  vesselIds?: string[];
  canEditVessels?: boolean;
  appUrl: string;
  inviterName: string;
  request?: Request | null;
}) {
  assertOrganizationManager(input.session);
  const email = normalizeEmail(input.email);
  if (!email.includes("@")) throw new Error("INVALID_EMAIL");
  const role = ALLOWED_ROLES.has(input.role) ? input.role : "member";
  const existing = await findUserByEmail(email);
  if (existing) throw new Error(existing.org_id === input.session.orgId ? "USER_ALREADY_IN_ORG" : "EMAIL_ALREADY_REGISTERED");
  const vesselIds = await validateVesselIds(input.session.orgId, input.vesselIds || []);
  await sql("update user_invitations set revoked_at=coalesce(revoked_at,now()) where org_id=$1 and lower(email)=lower($2) and accepted_at is null and revoked_at is null", [input.session.orgId, email]);
  const token = randomBytes(32).toString("base64url");
  const invitationId = `invite_${randomUUID()}`;
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  await sql(`
    insert into user_invitations(id,org_id,email,role,vessel_ids,invited_by,token_hash,expires_at)
    values($1,$2,$3,$4,$5,$6,$7,$8)
  `, [invitationId, input.session.orgId, email, role, JSON.stringify(vesselIds), input.session.userId, inviteHash(token), expiresAt]);
  const [org] = await sql<Row>("select name from organizations where id=$1", [input.session.orgId]);
  const inviteUrl = `${input.appUrl.replace(/\/$/, "")}/accept-invite?token=${encodeURIComponent(token)}`;
  await sendInvitationEmail({ to: email, inviter: input.inviterName || input.session.email || "A Neptune administrator", organization: org?.name || "your organization", inviteUrl, role });
  await recordAuditEvent({ session: input.session, action: "organization.user_invited", entityType: "user_invitation", entityId: invitationId, request: input.request, metadata: { email, role, vesselIds } });
  return { id: invitationId, email, role, vesselIds, expiresAt };
}

export async function acceptOrganizationInvitation(input: { token: string; name: string; password: string }) {
  const [invitation] = await sql<Row>(`
    select * from user_invitations
    where token_hash=$1 and accepted_at is null and revoked_at is null and expires_at > now()
    limit 1
  `, [inviteHash(input.token)]);
  if (!invitation) throw new Error("INVITATION_INVALID");
  if (input.password.length < 12) throw new Error("PASSWORD_TOO_SHORT");
  const existing = await findUserByEmail(invitation.email);
  if (existing) throw new Error("EMAIL_ALREADY_REGISTERED");
  const userId = `usr_${randomUUID()}`;
  const hash = await bcrypt.hash(input.password, 12);
  const [user] = await sql<Row>(`
    insert into users(id,org_id,name,email,password_hash,role,email_verified_at,is_active)
    values($1,$2,$3,$4,$5,$6,now(),true)
    returning id,org_id,name,email,role,email_verified_at,is_active
  `, [userId, invitation.org_id, input.name.trim().slice(0, 160), invitation.email, hash, invitation.role]);
  const vesselIds = Array.isArray(invitation.vessel_ids) ? invitation.vessel_ids.map(String) : [];
  await replaceVesselPermissions(invitation.org_id, userId, vesselIds, false);
  await sql("update user_invitations set accepted_at=now() where id=$1", [invitation.id]);
  await recordAuditEvent({ session: { userId, orgId: invitation.org_id, email: invitation.email }, action: "organization.invitation_accepted", entityType: "user", entityId: userId, metadata: { role: invitation.role } });
  return user;
}

export async function updateOrganizationUser(input: {
  session: Pick<Session, "userId" | "orgId" | "role" | "email">;
  userId: string;
  role?: string;
  isActive?: boolean;
  vesselIds?: string[];
  canEditVessels?: boolean;
  request?: Request | null;
}) {
  assertOrganizationManager(input.session);
  const [target] = await sql<Row>("select id,org_id,email,role,is_active from users where id=$1 and org_id=$2", [input.userId, input.session.orgId]);
  if (!target) throw new Error("USER_NOT_FOUND");
  if (isDesignatedAdminEmail(target.email) && target.id !== input.session.userId) throw new Error("PROTECTED_ADMIN_IDENTITY");
  if (input.role && !ALLOWED_ROLES.has(input.role) && input.role !== "admin" && input.role !== "owner") throw new Error("INVALID_ROLE");
  if (target.id === input.session.userId && input.isActive === false) throw new Error("CANNOT_DEACTIVATE_SELF");

  if (input.role || typeof input.isActive === "boolean") {
    await sql(`
      update users set
        role=coalesce($1,role),
        is_active=coalesce($2,is_active),
        updated_at=now()
      where id=$3 and org_id=$4
    `, [input.role || null, typeof input.isActive === "boolean" ? input.isActive : null, target.id, input.session.orgId]);
  }
  if (input.vesselIds) await replaceVesselPermissions(input.session.orgId, target.id, input.vesselIds, Boolean(input.canEditVessels));
  if (input.isActive === false) await revokeAllAuthSessions(target.id);
  await recordAuditEvent({ session: input.session, action: "organization.user_updated", entityType: "user", entityId: target.id, request: input.request, metadata: { role: input.role, isActive: input.isActive, vesselIds: input.vesselIds || undefined, canEditVessels: input.canEditVessels } });
  const [updated] = await sql<Row>("select id,name,email,role,email_verified_at,is_active,mfa_enabled,last_login_at,created_at from users where id=$1", [target.id]);
  return updated;
}

export async function revokeOrganizationInvitation(session: Pick<Session, "userId" | "orgId" | "role" | "email">, invitationId: string, request?: Request | null) {
  assertOrganizationManager(session);
  const [updated] = await sql<Row>("update user_invitations set revoked_at=coalesce(revoked_at,now()) where id=$1 and org_id=$2 and accepted_at is null returning id", [invitationId, session.orgId]);
  if (updated) await recordAuditEvent({ session, action: "organization.invitation_revoked", entityType: "user_invitation", entityId: invitationId, request });
  return Boolean(updated);
}

export async function listManagedDevices(orgId: string) {
  return sql<Row>(`
    select d.*,u.email as user_email,u.name as user_name
    from managed_devices d left join users u on u.id=d.user_id
    where d.org_id=$1 order by d.last_seen_at desc limit 250
  `, [orgId]);
}

export async function upsertManagedDevice(session: Pick<Session, "userId" | "orgId">, input: Row) {
  const deviceKey = String(input.deviceKey || "").trim().slice(0, 200);
  if (!deviceKey) throw new Error("DEVICE_KEY_REQUIRED");
  const [device] = await sql<Row>(`
    insert into managed_devices(
      id,org_id,user_id,device_key,label,platform,user_agent,app_version,installed,offline_capable,gps_permission,storage_bytes,queue_depth,last_sync_at,last_seen_at
    ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())
    on conflict(org_id,device_key) do update set
      user_id=excluded.user_id,
      label=coalesce(excluded.label,managed_devices.label),
      platform=excluded.platform,
      user_agent=excluded.user_agent,
      app_version=excluded.app_version,
      installed=excluded.installed,
      offline_capable=excluded.offline_capable,
      gps_permission=excluded.gps_permission,
      storage_bytes=excluded.storage_bytes,
      queue_depth=excluded.queue_depth,
      last_sync_at=coalesce(excluded.last_sync_at,managed_devices.last_sync_at),
      last_seen_at=now()
    returning *
  `, [
    `dev_${randomUUID()}`,
    session.orgId,
    session.userId,
    deviceKey,
    String(input.label || "").slice(0, 160) || null,
    String(input.platform || "").slice(0, 160) || null,
    String(input.userAgent || "").slice(0, 1000) || null,
    String(input.appVersion || "").slice(0, 80) || null,
    Boolean(input.installed),
    Boolean(input.offlineCapable),
    String(input.gpsPermission || "").slice(0, 40) || null,
    Number.isFinite(Number(input.storageBytes)) ? Math.max(0, Math.round(Number(input.storageBytes))) : null,
    Number.isFinite(Number(input.queueDepth)) ? Math.max(0, Math.round(Number(input.queueDepth))) : 0,
    input.lastSyncAt || null
  ]);
  return device;
}

export async function manageDevice(input: {
  session: Pick<Session, "userId" | "orgId" | "role" | "email">;
  deviceId: string;
  action: "revoke" | "restore" | "wipe" | "clear_wipe";
  request?: Request | null;
}) {
  assertOrganizationManager(input.session);
  const assignment: Record<string, string> = {
    revoke: "revoked_at=coalesce(revoked_at,now())",
    restore: "revoked_at=null",
    wipe: "wipe_requested_at=coalesce(wipe_requested_at,now())",
    clear_wipe: "wipe_requested_at=null"
  };
  const [device] = await sql<Row>(`update managed_devices set ${assignment[input.action]} where id=$1 and org_id=$2 returning *`, [input.deviceId, input.session.orgId]);
  if (!device) throw new Error("DEVICE_NOT_FOUND");
  await recordAuditEvent({ session: input.session, action: `device.${input.action}`, entityType: "managed_device", entityId: device.id, request: input.request, metadata: { deviceKey: device.device_key } });
  return device;
}

export async function getOrganizationAudit(orgId: string, limit = 150) {
  return sql<Row>(`
    select id,user_email,action,entity_type,entity_id,route,method,success,source,metadata,created_at
    from audit_events where org_id=$1 order by created_at desc limit $2
  `, [orgId, Math.max(1, Math.min(500, limit))]);
}
