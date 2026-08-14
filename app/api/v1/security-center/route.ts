import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { requireSession } from "@/src/lib/server/auth";
import { findUserByEmail, listResource } from "@/src/lib/server/db";
import {
  beginMfaSetup,
  completeMfaSetup,
  disableMfa,
  getUserSecurityState,
  listAuthSessions,
  recordAuditEvent,
  revokeAllAuthSessions,
  revokeAuthSession,
  verifyUserMfa
} from "@/src/lib/server/security";
import {
  beginPasskeyRegistration,
  finishPasskeyRegistration,
  listUserPasskeys,
  removePasskey
} from "@/src/lib/server/passkeys";
import {
  canManageOrganization,
  createOrganizationInvitation,
  getOrganizationAudit,
  getOrganizationProfile,
  listManagedDevices,
  listOrganizationInvitations,
  listOrganizationUsers,
  manageDevice,
  revokeOrganizationInvitation,
  updateOrganizationProfile,
  updateOrganizationUser,
  upsertManagedDevice
} from "@/src/lib/server/org-access";
import { assertAdministratorCapacity } from "@/src/lib/server/org-limits";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Login required." }, { status: 401 });
  if (message === "TRIAL_EXPIRED" || message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active Neptune access is required." }, { status: 402 });
  if (message === "ORG_MANAGER_REQUIRED") return NextResponse.json({ error: "Organization manager access is required." }, { status: 403 });
  if (message === "ADMINISTRATOR_LIMIT_REACHED") return NextResponse.json({ error: "This package has reached its organization-administrator limit. Upgrade the package or deactivate another administrator before adding one." }, { status: 403 });
  if (message === "PROTECTED_ADMIN_IDENTITY") return NextResponse.json({ error: "A designated Neptune administrator identity cannot be changed by another organization user." }, { status: 403 });
  if (message === "CANNOT_DEACTIVATE_SELF") return NextResponse.json({ error: "You cannot deactivate your own active session identity." }, { status: 400 });
  if (message === "USER_ALREADY_IN_ORG") return NextResponse.json({ error: "That user already belongs to this organization." }, { status: 409 });
  if (message === "EMAIL_ALREADY_REGISTERED") return NextResponse.json({ error: "That email is already registered to Neptune." }, { status: 409 });
  if (message === "PASSKEY_NOT_FOUND") return NextResponse.json({ error: "Passkey not found." }, { status: 404 });
  if (["PASSKEY_CHALLENGE_EXPIRED", "PASSKEY_REGISTRATION_FAILED", "PASSKEY_USER_NOT_ELIGIBLE"].includes(message)) return NextResponse.json({ error: "Passkey registration failed or expired. Start again from the security center." }, { status: 400 });
  if (message === "INVALID_EMAIL" || message === "INVALID_ROLE" || message === "INVALID_VESSEL_PERMISSION" || message === "ORGANIZATION_NAME_REQUIRED" || message === "INVALID_DEVICE_ACTION") return NextResponse.json({ error: message.replaceAll("_", " ").toLowerCase() }, { status: 400 });
  if (message === "USER_NOT_FOUND" || message === "DEVICE_NOT_FOUND") return NextResponse.json({ error: "Record not found." }, { status: 404 });
  if (message.startsWith("EMAIL_")) return NextResponse.json({ error: "Secure email delivery is not configured or failed." }, { status: 503 });
  console.error(error);
  return NextResponse.json({ error: "Unable to complete the security operation." }, { status: 500 });
}

export async function GET() {
  try {
    const session = await requireSession();
    const managerAccess = canManageOrganization(session);
    const [security, sessions, organization, passkeys] = await Promise.all([
      getUserSecurityState(session.userId),
      listAuthSessions(session.userId),
      getOrganizationProfile(session.orgId),
      listUserPasskeys(session.userId)
    ]);

    const [users, invitations, devices, audit, vessels] = managerAccess
      ? await Promise.all([
          listOrganizationUsers(session.orgId),
          listOrganizationInvitations(session.orgId),
          listManagedDevices(session.orgId),
          getOrganizationAudit(session.orgId),
          listResource("vessels", session.orgId)
        ])
      : [[], [], [], [], []];

    return NextResponse.json({
      managerAccess,
      currentSessionId: session.sessionId || null,
      security,
      sessions,
      organization,
      passkeys,
      users,
      invitations,
      devices,
      audit,
      vessels
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "mfa_setup") {
      const setup = beginMfaSetup({ userId: session.userId, email: session.email || "operator" });
      await recordAuditEvent({ session, action: "security.mfa_setup_started", route: "/api/v1/security-center", method: "POST", request });
      return NextResponse.json({ setup });
    }

    if (action === "mfa_enable") {
      const recoveryCodes = await completeMfaSetup(session.userId, String(body.setupToken || ""), String(body.code || ""));
      if (!recoveryCodes) return NextResponse.json({ error: "The authenticator code is invalid or the setup session expired." }, { status: 400 });
      await recordAuditEvent({ session, action: "security.mfa_enabled", entityType: "user", entityId: session.userId, route: "/api/v1/security-center", method: "POST", request });
      return NextResponse.json({ ok: true, recoveryCodes });
    }

    if (action === "mfa_disable") {
      const user = session.email ? await findUserByEmail(session.email) : null;
      if (!user || !await bcrypt.compare(String(body.password || ""), user.password_hash)) return NextResponse.json({ error: "Current password is required." }, { status: 401 });
      if (user.mfa_enabled && !await verifyUserMfa(user, String(body.code || ""))) return NextResponse.json({ error: "A valid authenticator or recovery code is required." }, { status: 401 });
      await disableMfa(session.userId);
      await recordAuditEvent({ session, action: "security.mfa_disabled", entityType: "user", entityId: session.userId, route: "/api/v1/security-center", method: "POST", request });
      return NextResponse.json({ ok: true });
    }

    if (action === "passkey_options") {
      const options = await beginPasskeyRegistration(session, process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin);
      return NextResponse.json({ options });
    }

    if (action === "passkey_register") {
      const passkey = await finishPasskeyRegistration({
        session,
        appUrl: process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin,
        response: body.response as RegistrationResponseJSON,
        label: String(body.label || "Passkey"),
        request
      });
      return NextResponse.json({ passkey }, { status: 201 });
    }

    if (action === "passkey_remove") {
      const passkey = await removePasskey(session, String(body.passkeyId || ""), request);
      return NextResponse.json({ passkey });
    }

    if (action === "revoke_session") {
      const sessionId = String(body.sessionId || "");
      await revokeAuthSession(sessionId, session.userId);
      await recordAuditEvent({ session, action: "security.session_revoked", entityType: "auth_session", entityId: sessionId, route: "/api/v1/security-center", method: "POST", request });
      return NextResponse.json({ ok: true, currentSessionRevoked: sessionId === session.sessionId });
    }

    if (action === "revoke_other_sessions") {
      await revokeAllAuthSessions(session.userId, session.sessionId || null);
      await recordAuditEvent({ session, action: "security.other_sessions_revoked", entityType: "user", entityId: session.userId, route: "/api/v1/security-center", method: "POST", request });
      return NextResponse.json({ ok: true });
    }

    if (action === "invite_user") {
      const role = String(body.role || "member");
      await assertAdministratorCapacity(session.orgId, session.entitlement.plan, role);
      const invitation = await createOrganizationInvitation({
        session,
        email: String(body.email || ""),
        role,
        vesselIds: Array.isArray(body.vesselIds) ? body.vesselIds.map(String) : [],
        canEditVessels: Boolean(body.canEditVessels),
        appUrl: process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin,
        inviterName: String(body.inviterName || session.email || "Neptune administrator"),
        request
      });
      return NextResponse.json({ invitation }, { status: 201 });
    }

    if (action === "update_user") {
      const targetUserId = String(body.userId || "");
      if (body.role) await assertAdministratorCapacity(session.orgId, session.entitlement.plan, String(body.role), targetUserId);
      const user = await updateOrganizationUser({
        session,
        userId: targetUserId,
        role: body.role ? String(body.role) : undefined,
        isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
        vesselIds: Array.isArray(body.vesselIds) ? body.vesselIds.map(String) : undefined,
        canEditVessels: typeof body.canEditVessels === "boolean" ? body.canEditVessels : undefined,
        request
      });
      return NextResponse.json({ user });
    }

    if (action === "revoke_invitation") {
      const ok = await revokeOrganizationInvitation(session, String(body.invitationId || ""), request);
      return NextResponse.json({ ok });
    }

    if (action === "organization_profile") {
      const organization = await updateOrganizationProfile(session, String(body.name || ""));
      await recordAuditEvent({ session, action: "organization.profile_updated", entityType: "organization", entityId: session.orgId, route: "/api/v1/security-center", method: "POST", request, metadata: { name: organization?.name } });
      return NextResponse.json({ organization });
    }

    if (action === "device_heartbeat") {
      const device = await upsertManagedDevice(session, body.device || {});
      return NextResponse.json({
        device: {
          id: device.id,
          revoked: Boolean(device.revoked_at),
          wipeRequested: Boolean(device.wipe_requested_at),
          lastSeenAt: device.last_seen_at
        }
      });
    }

    if (action === "device_action") {
      const deviceAction = String(body.deviceAction || "");
      if (!["revoke", "restore", "wipe", "clear_wipe"].includes(deviceAction)) throw new Error("INVALID_DEVICE_ACTION");
      const device = await manageDevice({
        session,
        deviceId: String(body.deviceId || ""),
        action: deviceAction as "revoke" | "restore" | "wipe" | "clear_wipe",
        request
      });
      return NextResponse.json({ device });
    }

    return NextResponse.json({ error: "Unknown security action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
