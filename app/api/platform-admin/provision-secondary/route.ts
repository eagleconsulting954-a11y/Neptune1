import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/server/auth";
import { designatedAdminEmail, designatedAdminEmails, isDesignatedAdminEmail } from "@/src/lib/server/admin-access";
import { findUserByEmail, sql, type Row } from "@/src/lib/server/db";
import { createOrganizationInvitation } from "@/src/lib/server/org-access";
import { recordAuditEvent } from "@/src/lib/server/security";

const SECONDARY_EMAIL = designatedAdminEmails()[1];

async function requirePrimaryAdmin() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if (!isDesignatedAdminEmail(session.email) || String(session.email).toLowerCase() !== designatedAdminEmail()) throw new Error("PRIMARY_ADMIN_REQUIRED");
  return session;
}

async function status(orgId: string) {
  const user = await findUserByEmail(SECONDARY_EMAIL);
  const [pending] = await sql<Row>(`
    select id,email,role,expires_at,created_at
    from user_invitations
    where org_id=$1 and lower(email)=lower($2) and accepted_at is null and revoked_at is null and expires_at > now()
    order by created_at desc limit 1
  `, [orgId, SECONDARY_EMAIL]);
  return {
    email: SECONDARY_EMAIL,
    provisioned: Boolean(user),
    sameOrganization: Boolean(user && String(user.org_id) === orgId),
    active: Boolean(user?.is_active),
    verified: Boolean(user?.email_verified_at),
    pendingInvitation: pending || null
  };
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Login required." }, { status: 401 });
  if (message === "PRIMARY_ADMIN_REQUIRED") return NextResponse.json({ error: "Only the primary designated Neptune administrator can provision the secondary administrator." }, { status: 403 });
  if (message.startsWith("EMAIL_")) return NextResponse.json({ error: "Secure invitation email delivery is not configured or failed." }, { status: 503 });
  if (message === "EMAIL_ALREADY_REGISTERED") return NextResponse.json({ error: "The secondary administrator email already belongs to another Neptune organization. Review the account before changing access." }, { status: 409 });
  console.error(error);
  return NextResponse.json({ error: "Unable to provision the secondary administrator." }, { status: 500 });
}

export async function GET() {
  try {
    const session = await requirePrimaryAdmin();
    return NextResponse.json(await status(session.orgId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requirePrimaryAdmin();
    const existing = await status(session.orgId);
    if (existing.provisioned) return NextResponse.json({ ok: true, status: existing, message: "The secondary designated administrator account already exists." });
    if (existing.pendingInvitation) return NextResponse.json({ ok: true, status: existing, message: "A valid secure invitation is already pending for the secondary administrator." });

    const [primary] = await sql<Row>("select name from users where id=$1 and org_id=$2 limit 1", [session.userId, session.orgId]);
    const invitation = await createOrganizationInvitation({
      session,
      email: SECONDARY_EMAIL,
      role: "org_admin",
      vesselIds: [],
      canEditVessels: true,
      appUrl: process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin,
      inviterName: primary?.name || session.email || "Primary Neptune administrator",
      request
    });
    await recordAuditEvent({
      session,
      action: "platform.secondary_admin_provisioned",
      entityType: "user_invitation",
      entityId: invitation.id,
      route: "/api/platform-admin/provision-secondary",
      method: "POST",
      request,
      metadata: { email: SECONDARY_EMAIL }
    });
    return NextResponse.json({ ok: true, invitation, status: await status(session.orgId), message: "Secure secondary-administrator invitation sent." }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
