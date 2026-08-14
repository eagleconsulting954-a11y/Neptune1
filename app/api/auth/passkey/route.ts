import { NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { setAccessCookie, setSession } from "@/src/lib/server/auth";
import { getEntitlement } from "@/src/lib/server/trial";
import { beginPasskeyAuthentication, finishPasskeyAuthentication } from "@/src/lib/server/passkeys";
import { assertLoginAllowed, noteLoginFailure, noteLoginSuccess, recordAuditEvent, requestIp } from "@/src/lib/server/security";
import { isDesignatedAdminEmail } from "@/src/lib/server/admin-access";
import { sql } from "@/src/lib/server/db";

function appUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

function safeRedirect(value: unknown) {
  const path = String(value || "/dashboard");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

export async function POST(request: Request) {
  const ip = requestIp(request);
  let attemptedEmail = "";
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "options");
    const email = String(body.email || "").trim().toLowerCase();
    attemptedEmail = email;
    if (!email || !email.includes("@")) return NextResponse.json({ error: "Enter your account email." }, { status: 400 });
    await assertLoginAllowed(email, ip);

    if (action === "options") {
      const started = await beginPasskeyAuthentication(email, appUrl(request));
      if (!started) {
        await noteLoginFailure(email, ip);
        return NextResponse.json({ error: "No passkey is available for this account.", code: "PASSKEY_UNAVAILABLE" }, { status: 404 });
      }
      return NextResponse.json({ options: started.options });
    }

    if (action === "verify") {
      const response = body.response as AuthenticationResponseJSON;
      if (!response?.id) return NextResponse.json({ error: "Passkey response is required." }, { status: 400 });
      const authenticated = await finishPasskeyAuthentication({ email, appUrl: appUrl(request), response, request });
      const user = authenticated.user;
      await noteLoginSuccess(email);
      const sessionId = await setSession(
        { userId: user.id, orgId: user.org_id, role: user.role, email: user.email },
        { userAgent: request.headers.get("user-agent"), ip, deviceLabel: String(body.deviceLabel || "Passkey device").slice(0, 160) }
      );
      await sql("update users set last_login_at=now(),updated_at=now() where id=$1", [user.id]);
      await recordAuditEvent({
        session: { userId: user.id, orgId: user.org_id, email: user.email },
        action: "auth.passkey_login_success",
        entityType: "auth_session",
        entityId: sessionId,
        route: "/api/auth/passkey",
        method: "POST",
        request,
        metadata: { passkeyId: authenticated.passkeyId }
      });
      const entitlement = await getEntitlement(user.org_id);
      await setAccessCookie(entitlement);
      const requested = safeRedirect(body.from);
      const redirect = isDesignatedAdminEmail(user.email) && requested.startsWith("/platform-admin")
        ? "/platform-admin"
        : entitlement.allowed ? requested : "/trial-expired";
      return NextResponse.json({ ok: true, redirect });
    }

    return NextResponse.json({ error: "Unknown passkey action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "LOGIN_RATE_LIMITED") return NextResponse.json({ error: "Too many sign-in attempts. Try again later.", code: "LOGIN_RATE_LIMITED" }, { status: 429 });
    if (["PASSKEY_AUTH_FAILED", "PASSKEY_CHALLENGE_EXPIRED"].includes(message)) {
      if (attemptedEmail) {
        try { await noteLoginFailure(attemptedEmail, ip); } catch {}
      }
      return NextResponse.json({ error: "Passkey verification failed or expired.", code: message }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: "Unable to complete passkey sign-in." }, { status: 500 });
  }
}
