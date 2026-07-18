import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByEmail, ensureSchema } from "@/src/lib/server/db";
import { setAccessCookie, setSession } from "@/src/lib/server/auth";
import { getEntitlement } from "@/src/lib/server/trial";
import { recordSystemError } from "@/src/lib/server/platform-admin";
import { migrateFrancisOwnerAccount } from "@/src/lib/server/owner-migration";

function safeRedirect(value: unknown) {
  const path = String(value || "/dashboard");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

function platformAdminAllowed(role: string, email: string) {
  const configured = [process.env.PLATFORM_ADMIN_EMAILS, process.env.NEPTUNE_OWNER_EMAIL]
    .filter(Boolean)
    .join(",")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  return ["platform_admin", "owner", "super_admin"].includes(String(role).toLowerCase()) || configured.includes(email.toLowerCase());
}

export async function POST(request: Request) {
  let attemptedEmail = "";
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    attemptedEmail = email;
    const password = String(body.password || "");
    const redirect = safeRedirect(body.from);
    await ensureSchema();
    await migrateFrancisOwnerAccount();

    const user = await findUserByEmail(email);
    if (user && await bcrypt.compare(password, user.password_hash)) {
      await setSession({ userId: user.id, orgId: user.org_id, role: user.role, email: user.email });
      if (platformAdminAllowed(user.role, user.email) && redirect.startsWith("/platform-admin")) {
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
      await setSession({ userId: "usr_demo", orgId: "org_demo", role: "admin", email: demoEmail });
      return NextResponse.json({ ok: true, redirect: "/demo" });
    }

    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  } catch (error) {
    console.error(error);
    await recordSystemError({
      source: "api",
      severity: "critical",
      route: "/api/auth/login",
      method: "POST",
      message: error instanceof Error ? error.message : "Unknown login failure",
      stack: error instanceof Error ? error.stack : null,
      statusCode: 500,
      userEmail: attemptedEmail || null
    });
    return NextResponse.json({ error: "Unable to complete login." }, { status: 500 });
  }
}
