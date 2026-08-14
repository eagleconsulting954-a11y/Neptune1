import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByEmail, ensureSchema, sql } from "@/src/lib/server/db";
import { setAccessCookie, setSession } from "@/src/lib/server/auth";
import { getEntitlement } from "@/src/lib/server/trial";
import { recordSystemError } from "@/src/lib/server/platform-admin";
import { migrateFrancisOwnerAccount } from "@/src/lib/server/owner-migration";
import { isDesignatedAdminEmail } from "@/src/lib/server/admin-access";
import {
  assertLoginAllowed,
  noteLoginFailure,
  noteLoginSuccess,
  recordAuditEvent,
  requestIp,
  secureHash,
  verifyUserMfa
} from "@/src/lib/server/security";

function safeRedirect(value: unknown) {
  const path = String(value || "/dashboard");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

export async function POST(request: Request) {
  let attemptedEmail = "";
  const ip = requestIp(request);
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    attemptedEmail = email;
    const password = String(body.password || "");
    const mfaCode = String(body.mfaCode || "").trim();
    const redirect = safeRedirect(body.from);
    await ensureSchema();
    await migrateFrancisOwnerAccount();
    await assertLoginAllowed(email, ip);

    const user = await findUserByEmail(email);
    const passwordValid = Boolean(user && user.is_active !== false && await bcrypt.compare(password, user.password_hash));

    if (user && passwordValid) {
      if (!user.email_verified_at) {
        await recordAuditEvent({
          session: { userId: user.id, orgId: user.org_id, email: user.email },
          action: "auth.login_blocked_unverified",
          route: "/api/auth/login",
          method: "POST",
          success: false,
          request
        });
        return NextResponse.json({
          error: "Verify your email before signing in.",
          code: "EMAIL_VERIFICATION_REQUIRED",
          email: user.email
        }, { status: 403 });
      }

      if (user.mfa_enabled) {
        if (!mfaCode) {
          return NextResponse.json({
            error: "Enter the six-digit authenticator code or a recovery code.",
            code: "MFA_REQUIRED",
            mfaRequired: true
          }, { status: 428 });
        }
        if (!await verifyUserMfa(user, mfaCode)) {
          await noteLoginFailure(email, ip);
          await recordAuditEvent({
            session: { userId: user.id, orgId: user.org_id, email: user.email },
            action: "auth.mfa_failed",
            route: "/api/auth/login",
            method: "POST",
            success: false,
            request
          });
          return NextResponse.json({ error: "Invalid authentication code.", code: "MFA_INVALID", mfaRequired: true }, { status: 401 });
        }
      }

      await noteLoginSuccess(email);
      const sessionId = await setSession(
        { userId: user.id, orgId: user.org_id, role: user.role, email: user.email },
        {
          userAgent: request.headers.get("user-agent"),
          ip,
          deviceLabel: String(body.deviceLabel || "").slice(0, 160) || null
        }
      );
      await sql("update users set last_login_at=now(),updated_at=now() where id=$1", [user.id]);
      await recordAuditEvent({
        session: { userId: user.id, orgId: user.org_id, email: user.email },
        action: "auth.login_success",
        entityType: "auth_session",
        entityId: sessionId,
        route: "/api/auth/login",
        method: "POST",
        request,
        metadata: { mfa: Boolean(user.mfa_enabled) }
      });

      if (isDesignatedAdminEmail(user.email) && redirect.startsWith("/platform-admin")) {
        return NextResponse.json({ ok: true, redirect: "/platform-admin", platformAdmin: true });
      }

      const entitlement = await getEntitlement(user.org_id);
      await setAccessCookie(entitlement);
      return NextResponse.json({
        ok: true,
        redirect: entitlement.allowed ? redirect : "/trial-expired",
        entitlement
      });
    }

    const demoEnabled = process.env.ALLOW_DEMO_LOGIN === "true";
    const demoEmail = process.env.DEMO_ADMIN_EMAIL?.toLowerCase();
    const demoPassword = process.env.DEMO_ADMIN_PASSWORD;
    if (demoEnabled && demoEmail && demoPassword && email === demoEmail && password === demoPassword) {
      await setSession({ userId: "usr_demo", orgId: "org_demo", role: "admin", email: demoEmail }, { persist: false });
      return NextResponse.json({ ok: true, redirect: "/demo" });
    }

    await noteLoginFailure(email, ip);
    await recordAuditEvent({
      action: "auth.login_failed",
      route: "/api/auth/login",
      method: "POST",
      success: false,
      request,
      metadata: { emailHash: secureHash(email || "unknown", "failed-login-email").slice(0, 24) }
    });
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "LOGIN_RATE_LIMITED") {
      return NextResponse.json({ error: "Too many sign-in attempts. Try again later.", code: "LOGIN_RATE_LIMITED" }, { status: 429 });
    }
    console.error(error);
    await recordSystemError({
      source: "api",
      severity: "critical",
      route: "/api/auth/login",
      method: "POST",
      message,
      stack: error instanceof Error ? error.stack : null,
      statusCode: 500,
      userEmail: attemptedEmail || null
    });
    return NextResponse.json({ error: "Unable to complete login." }, { status: 500 });
  }
}
