import { NextResponse } from "next/server";
import { setAccessCookie, setSession } from "@/src/lib/server/auth";
import { finishOidcSso } from "@/src/lib/server/oidc-sso";
import { getEntitlement } from "@/src/lib/server/trial";
import { recordAuditEvent, requestIp } from "@/src/lib/server/security";
import { sql } from "@/src/lib/server/db";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    if (!code || !state) return NextResponse.redirect(new URL("/sso?error=missing_callback", request.url));
    const completed = await finishOidcSso({ code, state });
    const user = completed.user;
    const sessionId = await setSession(
      { userId: user.id, orgId: user.org_id, role: user.role, email: user.email },
      { userAgent: request.headers.get("user-agent"), ip: requestIp(request), deviceLabel: "Enterprise SSO session" }
    );
    await sql("update users set last_login_at=now(),updated_at=now() where id=$1", [user.id]);
    await recordAuditEvent({
      session: { userId: user.id, orgId: user.org_id, email: user.email },
      action: "auth.oidc_login_success",
      entityType: "auth_session",
      entityId: sessionId,
      route: "/api/auth/sso/callback",
      method: "GET",
      request,
      metadata: { subject: String(completed.profile.sub || "").slice(0, 200), issuerLogin: true }
    });
    const entitlement = await getEntitlement(user.org_id);
    await setAccessCookie(entitlement);
    const target = entitlement.allowed ? completed.returnTo : "/trial-expired";
    return NextResponse.redirect(new URL(target, request.url));
  } catch (error) {
    console.error(error);
    const code = error instanceof Error ? error.message.split(":")[0] : "SSO_FAILED";
    return NextResponse.redirect(new URL(`/sso?error=${encodeURIComponent(code)}`, request.url));
  }
}
