import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByEmail, ensureSchema } from "@/src/lib/server/db";
import { setSession } from "@/src/lib/server/auth";

function safeRedirect(value: unknown) {
  const path = String(value || "/dashboard");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").toLowerCase();
  const password = String(body.password || "");
  const redirect = safeRedirect(body.from);
  await ensureSchema();

  const user = await findUserByEmail(email);
  if (user && await bcrypt.compare(password, user.password_hash)) {
    await setSession({ userId: user.id, orgId: user.org_id, role: user.role, email: user.email });
    return NextResponse.json({ ok: true, redirect });
  }

  const demoEmail = (process.env.DEMO_ADMIN_EMAIL || "admin@neptune.local").toLowerCase();
  const demoPassword = process.env.DEMO_ADMIN_PASSWORD || "neptune-admin";
  if (email === demoEmail && password === demoPassword) {
    await setSession({ userId: "usr_demo", orgId: "org_demo", role: "admin", email: demoEmail });
    return NextResponse.json({ ok: true, redirect });
  }

  return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
}
