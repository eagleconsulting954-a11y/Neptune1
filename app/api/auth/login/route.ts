import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByEmail, ensureSchema } from "@/src/lib/server/db";
import { setAccessCookie, setSession } from "@/src/lib/server/auth";
import { getEntitlement } from "@/src/lib/server/trial";

function safeRedirect(value: unknown) {
  const path = String(value || "/dashboard");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").toLowerCase();
    const password = String(body.password || "");
    const redirect = safeRedirect(body.from);
    await ensureSchema();

    const user = await findUserByEmail(email);
    if (user && await bcrypt.compare(password, user.password_hash)) {
      await setSession({ userId: user.id, orgId: user.org_id, role: user.role, email: user.email });
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
    return NextResponse.json({ error: "Unable to complete login." }, { status: 500 });
  }
}
